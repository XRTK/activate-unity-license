const core = require('@actions/core');
const github = require('@actions/github');

const main = async () => {
    try {
        // return license if pro/plus
        console.log('-quit -batchmode -returnlicense -username name@example.com -password XXXXXXXXXXXXX');
        // -quit -batchmode -returnlicense -username name@example.com -password XXXXXXXXXXXXX
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();