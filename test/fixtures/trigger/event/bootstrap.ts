import  path from 'path';
import { ArtusApplication } from '../../../../src';
import { event } from './app';

async function main() {
  const app: ArtusApplication = new ArtusApplication();
  await app.load({
    items: [
      {
        path: path.resolve(__dirname, './app'),
        extname: '.ts',
        filename: 'app.ts',
        loader: 'extension',
        source: 'app'
      },
      {
        path: path.resolve(__dirname, './eventTrigger'),
        extname: '.ts',
        filename: 'eventTrigger.ts',
        loader: 'module',
        source: 'app'
      }
    ]
  });
  await app.run();

  return app;
};

function pub(e: 'e1' | 'e2', p: any) {
  event.emit(e, p);
}

export {
  main,
  pub
};