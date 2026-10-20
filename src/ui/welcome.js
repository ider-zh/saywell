import {initLocale,previewNotice,$} from './shared.js';
import {mountSetup} from './setup.js';
await initLocale();previewNotice();mountSetup($('#welcome-setup'),{welcome:true});
