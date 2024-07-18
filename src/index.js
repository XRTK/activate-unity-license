const core = require('@actions/core');
const activate = require('./activate');
const deactivate = require('./deactivate');
const IsPost = !!core.getState('isPost');

const main = async () => {
    if (!IsPost) {
        // activate license
        await activate.Run();
    } else {
        // return license
        await deactivate.Run();
    }
}

main();
