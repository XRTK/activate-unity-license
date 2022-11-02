const core = require('@actions/core');
const github = require('@actions/github');

const main = async () => {
    try {
        console.log(`Pre: Hello World!`);
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();