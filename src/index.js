const core = require('@actions/core');
const activate = require('./activate');
const deactivate = require('./deactivate');
const IsPost = !!core.getState('isPost');

const main = async () => {
    core.saveState('isPost', true);

    if (!IsPost) {
        // activate license
        await activate.Run();
    } else {
        // return license
        await deactivate.Run();
    }
}

// Call the main function to run the action
main();