import { Container } from '@artus/injection';
import { DefineLoader } from '../decorator';
import { ManifestItem, Loader, LoaderFindOptions } from '../types';
import { ExceptionItem } from '../../exception/types';
import { ExceptionHandler } from '../../exception';
import { loadMetaFile } from '../../utils/load_meta_file';
import { EXCEPTION_FILENAME } from '../../constant';
import { isMatch } from '../../utils';

@DefineLoader('exception')
class ExceptionLoader implements Loader {
  private container: Container;

  constructor(container) {
    this.container = container;
  }

  static async is(opts: LoaderFindOptions) {
    return isMatch(opts.filename, EXCEPTION_FILENAME);
  }

  async load(item: ManifestItem) {
    const exceptionHandler = this.container.get(ExceptionHandler);
    try {
      const codeMap: Record<string, ExceptionItem> = await loadMetaFile<
      Record<string, ExceptionItem>
      >(item.path);
      for (const [errCode, exceptionItem] of Object.entries(codeMap)) {
        exceptionHandler.registerCode(errCode, exceptionItem);
      }
      return codeMap;
    } catch (error) {
      console.warn(`[Artus-Exception] Parse CodeMap ${item.path} failed: ${error.message}`);
      return void 0;
    }
  }
}

export default ExceptionLoader;
