const core = require('@actions/core');
const licensingClient = require('./licensing-client');

async function Run() {
    try {
        if (licensingClient.hasExistingLicense()) {
            console.info(`::group::Returning Unity License`);
            await licensingClient.returnLicense();
            console.info(`::endgroup::`);
        }
    } catch (error) {
        core.setFailed(`Failed to deactivate license! ${error.message}`);
    }
};

module.exports = { Run }
