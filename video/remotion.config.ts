import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.setBrowserExecutable('/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell');
Config.setChromiumDisableWebSecurity(false);
Config.setChromiumOpenGlRenderer('swangle');
