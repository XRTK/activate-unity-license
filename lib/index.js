const activate = require('./activate');
const deactivate = require('./deactivate');

const main = async () => {
    if (!post.IsPost) {
        // activate license
        await activate.Run();
    } else {
        // return license
        await deactivate.Run();
    }
}

// Call the main function to run the action
main();