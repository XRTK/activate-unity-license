"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Crawler = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const log4js_1 = require("log4js");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger = (0, log4js_1.getLogger)();
class Crawler {
    constructor(debug, headless, downloadDir) {
        this.headless = false;
        this.tmpDir = "";
        this.downloadDir = "";
        this.hasError = false;
        this.errorDump = "";
        Object.assign(this, { headless, downloadDir });
        logger.level = debug ? "debug" : "off";
        this.errorDump = debug ? "error.html" : "";
    }
    async run() {
        logger.debug(`Run crawler: headless=${this.headless}`);
        const browser = await puppeteer_1.default.launch({
            headless: this.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        this.page = (await browser.pages())[0];
        //
        // there can be a privilege problem to create a directory
        //
        //this.tmpDir = path.join(os.tmpdir(), Math.random().toString(32).substring(2));
        this.tmpDir = path.join(".", Math.random().toString(32).substring(2));
        fs.mkdirSync(this.tmpDir);
        const _tempDir = path.resolve(this.tmpDir);
        console.log(`temDir ${_tempDir}`);
        const client = await this.page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: _tempDir,
        });
        try {
            logger.debug(`Start crawl`);
            await this.crawl();
        }
        catch (e) {
            if (this.errorDump) {
                fs.writeFileSync(this.errorDump, await this.page.content());
                console.log(`Current DOM has been saved at ${this.errorDump}`);
            }
            throw e;
        }
        finally {
            await browser.close();
        }
    }
    debug(message, ...args) {
        logger.debug(message, ...args);
    }
    async goto(url) {
        logger.debug(`goto: ${url}`);
        await Promise.all([
            this.page.goto(url),
            this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        ]);
    }
    async exists(selector) {
        logger.debug(`exists: ${selector}`);
        await this.page.waitForTimeout(1000);
        try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            logger.debug(`  -> true`);
            return true;
        }
        catch (e) {
            logger.debug(`  -> false`);
            return false;
        }
    }
    ;
    async click(selector, options) {
        logger.debug(`click: ${selector}`);
        await this.page.waitForTimeout(1000);
        await Promise.all([
            this.page.click(selector, options),
            this.page.waitForNavigation({ waitUntil: 'load' }),
        ]);
    }
    async type(selector, text, options) {
        logger.debug(`type: ${selector} => ${text}`);
        await this.page.waitForTimeout(1000);
        return await this.page.type(selector, text, options);
    }
    readUserInput(question, password = false, timeout = 5 * 60 * 1000) {
        logger.debug(`readUserInput: ${question}, password=${password}, timeout=${timeout}`);
        return new Promise(resolve => {
            // Timeout (5 minutes)
            setTimeout(_ => {
                console.log("timeout");
                resolve("");
            }, timeout);
            const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
            readline.stdoutMuted = password;
            readline.question(question, (answer) => {
                resolve(answer);
                readline.close();
            });
            readline._writeToOutput = (s) => readline.output.write(password && /\w/.test(s) ? "*" : s);
        });
    }
    async waitForTimeout(milliseconds) {
        logger.debug(`waitForTimeout: ${milliseconds}`);
        return await this.page.waitForTimeout(milliseconds);
    }
    async waitForSelector(selector) {
        logger.debug(`waitForSelector: ${selector}`);
        return await this.page.waitForSelector(selector, { timeout: 5000 });
    }
    async waitAndClick(selector) {
        logger.debug(`waitAndClick: ${selector}`);
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.evaluate((s) => {
            const element = document.querySelector(s);
            if (element !== null)
                element.click();
        }, selector);
    }
    async waitForDownload(timeout = 5000) {
        logger.debug(`waitForDownload: timeout=${timeout}`);
        let elapsed = 0;
        let downloadFile;
        do {
            await new Promise(r => setTimeout(r, 100));
            elapsed += 100;
            downloadFile = fs.readdirSync(this.tmpDir)[0];
        } while (elapsed < timeout && (!downloadFile || downloadFile.endsWith('.crdownload')));
        if (!downloadFile) {
            return undefined;
        }
        // create download dir
        if (!fs.existsSync(this.downloadDir) || !fs.statSync(this.downloadDir).isDirectory()) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
        // move to download path
        const downloadPath = path.resolve(this.downloadDir, downloadFile);
        fs.copyFileSync(path.resolve(this.tmpDir, downloadFile), downloadPath);
        return downloadPath;
    }
}
exports.Crawler = Crawler;
//# sourceMappingURL=crawler.js.map