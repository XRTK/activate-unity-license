const core = require('@actions/core');
const exec = require('@actions/exec');
const licensingClient = require('./licensing-client');

async function Run() {
    try {
        if (licensingClient.hasExistingLicense()) {
            console.info(`::group::Returning Unity License`);
            const client = licensingClient.getLicensingClient();
            await exec.exec(`"${client}" --return-ulf`);
            await exec.exec(`"${client}" --showEntitlements`);
            console.info(`::endgroup::`);
        }
    } catch (error) {
        core.setFailed(`Failed to deactivate license! ${error.message}`);
    }
};

module.exports = { Run }
