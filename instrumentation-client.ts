import LogRocket from 'logrocket';

let hasInitializedLogRocket = false;

if (typeof window !== 'undefined' && !hasInitializedLogRocket) {
  LogRocket.init('wiqodt/survey');
  hasInitializedLogRocket = true;
}
