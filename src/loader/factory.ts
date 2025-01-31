import * as path from 'path';
import { isInjectable, Container } from '@artus/injection';
import { ArtusInjectEnum, DEFAULT_LOADER, HOOK_FILE_LOADER, LOADER_NAME_META } from '../constant';
import {
  Manifest,
  ManifestItem,
  LoaderConstructor,
  Loader,
  LoaderFindOptions,
  LoaderFindResult,
} from './types';
import ConfigurationHandler from '../configuration';
import { LifecycleManager } from '../lifecycle';
import compatibleRequire from '../utils/compatible_require';
import LoaderEventEmitter, { LoaderEventListener } from './loader_event';
import { isClass } from '../utils/is';

export class LoaderFactory {
  private container: Container;
  private static loaderClazzMap: Map<string, LoaderConstructor> = new Map();
  private loaderEmitter: LoaderEventEmitter;

  static register(clazz: LoaderConstructor) {
    const loaderName = Reflect.getMetadata(LOADER_NAME_META, clazz);
    this.loaderClazzMap.set(loaderName, clazz);
  }

  constructor(container: Container) {
    this.container = container;
    this.loaderEmitter = new LoaderEventEmitter();
  }

  static create(container: Container): LoaderFactory {
    return new LoaderFactory(container);
  }

  get lifecycleManager(): LifecycleManager {
    return this.container.get(ArtusInjectEnum.LifecycleManager);
  }

  get configurationHandler(): ConfigurationHandler {
    return this.container.get(ConfigurationHandler);
  }

  addLoaderListener(eventName: string, listener: LoaderEventListener) {
    this.loaderEmitter.addListener(eventName, listener);
    return this;
  }

  removeLoaderListener(eventName: string, stage?: 'before' | 'after') {
    this.loaderEmitter.removeListener(eventName, stage);
    return this;
  }

  getLoader(loaderName: string): Loader {
    const LoaderClazz = LoaderFactory.loaderClazzMap.get(loaderName);
    if (!LoaderClazz) {
      throw new Error(`Cannot find loader '${loaderName}'`);
    }
    return new LoaderClazz(this.container);
  }

  async loadManifest(manifest: Manifest, root?: string): Promise<void> {
    await this.loadItemList(manifest.items, root);
  }

  async loadItemList(itemList: ManifestItem[] = [], root?: string): Promise<void> {
    let prevLoader = '';
    for (const item of itemList) {
      item.path = root ? path.join(root, item.path) : item.path;
      const curLoader = item.loader ?? DEFAULT_LOADER;
      if (item.loader !== prevLoader) {
        if (prevLoader) {
          await this.loaderEmitter.emitAfter(prevLoader);
        }
        await this.loaderEmitter.emitBefore(curLoader);
        prevLoader = curLoader;
      }
      await this.loaderEmitter.emitBeforeEach(curLoader, item);
      const result = await this.loadItem(item);
      await this.loaderEmitter.emitAfterEach(curLoader, item, result);
    }
    if (prevLoader) {
      await this.loaderEmitter.emitAfter(prevLoader);
    }
  }

  loadItem(item: ManifestItem): Promise<any> {
    const loaderName = item.loader || DEFAULT_LOADER;
    const loader = this.getLoader(loaderName);
    loader.state = item._loaderState;
    return loader.load(item);
  }

  async findLoader(opts: LoaderFindOptions): Promise<LoaderFindResult|null> {
    const loaderName = await this.findLoaderName(opts);
    if (!loaderName) {
      return null;
    }

    const loaderClazz = LoaderFactory.loaderClazzMap.get(loaderName);
    if (!loaderClazz) {
      throw new Error(`Cannot find loader '${loaderName}'`);
    }
    const result: LoaderFindResult = {
      loaderName,
    };
    if (loaderClazz.onFind) {
      result.loaderState = await loaderClazz.onFind(opts);
    }
    return result;
  }

  async findLoaderName(opts: LoaderFindOptions): Promise<string|null> {
    for (const [loaderName, LoaderClazz] of LoaderFactory.loaderClazzMap.entries()) {
      if (await LoaderClazz.is?.(opts)) {
        return loaderName;
      }
    }
    const { root, filename } = opts;

    // require file for find loader
    const targetClazz = await compatibleRequire(path.join(root, filename));
    if (!isClass(targetClazz)) {
      // The file is not export with default class
      return null;
    }

    // get loader from reflect metadata
    const loaderMd = Reflect.getMetadata(HOOK_FILE_LOADER, targetClazz);
    if (loaderMd?.loader) {
      return loaderMd.loader;
    }

    // default loder with @Injectable
    const injectableMd = isInjectable(targetClazz);
    if (injectableMd) {
      return DEFAULT_LOADER;
    }

    return null;
  }
}
