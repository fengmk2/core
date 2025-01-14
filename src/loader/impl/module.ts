import { Container, InjectableDefinition } from '@artus/injection';
import { DefineLoader } from '../decorator';
import { ManifestItem, Loader } from '../types';
import compatibleRequire from '../../utils/compatible_require';
import { SHOULD_OVERWRITE_VALUE } from '../../constant';

@DefineLoader('module')
class ModuleLoader implements Loader {
  private container: Container;

  constructor(container) {
    this.container = container;
  }

  async load(item: ManifestItem) {
    const moduleClazz = await compatibleRequire(item.path);
    const opts: Partial<InjectableDefinition> = {
      path: item.path,
      type: moduleClazz,
    };
    if (item.id) {
      opts.id = item.id;
    }

    const shouldOverwriteValue = Reflect.getMetadata(SHOULD_OVERWRITE_VALUE, moduleClazz);

    if (shouldOverwriteValue || !this.container.hasValue(opts)) {
      this.container.set(opts);
    }
    return moduleClazz;
  }
}

export default ModuleLoader;
