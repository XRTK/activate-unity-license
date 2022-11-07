const core = require('@actions/core');
const activate = require('./activate');
const deactivate = require('./deactivate');

const ReturnLicense = !!core.getState('returnLicense');

const main = async () => {
    if (!ReturnLicense) {
        // activate license
        await activate.Run();
    } else {
        // return license
        await deactivate.Run();
    }
}

// Call the main function to run the action
main();