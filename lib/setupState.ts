// Temporary: remembers setup only while the app is open.
// Will be replaced with real saved storage later.
let setupDone = false;

export const isSetupDone = () => setupDone;
export const markSetupDone = () => { setupDone = true; };