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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs_1 = __importDefault(require("fs"));
function extract(output) {
    let efficiency = 0;
    let wastedBytes = 0;
    let userWastedPercent = 0;
    for (const line of output.split('\n')) {
        if (line.includes('efficiency:')) {
            efficiency = +line.match(/[+-]?\d+(\.\d+)?/)[0];
        }
        else if (line.includes('wastedBytes:')) {
            wastedBytes = +line.match(/[+-]?\d+(\.\d+)?/)[0];
        }
        else if (line.includes('userWastedPercent:')) {
            userWastedPercent = +line.match(/[+-]?\d+(\.\d+)?/)[0];
        }
    }
    return {
        efficiency: efficiency,
        wastedBytes: wastedBytes,
        userWastedPercent: userWastedPercent,
    };
}
function setActionOutput(name, value) {
    const ghOutput = process.env['GITHUB_OUTPUT'];
    if (ghOutput) {
        fs_1.default.appendFileSync(ghOutput, `${name}=${value}\n`);
    }
    else {
        // Fallback for local testing
        core.setOutput(name, value);
    }
}
async function run() {
    try {
        const image = core.getInput('image');
        const config = core.getInput('config');
        const exitZero = core.getInput('exit-zero');
        const tag = core.getInput('dive-tag') || 'latest';
        if (config && !fs_1.default.existsSync(config)) {
            core.setFailed(`Dive configuration file ${config} doesn't exist!`);
            return;
        }
        const dive = `wagoodman/dive:${tag}`;
        const runOptions = [
            '-e',
            'CI=true',
            '--rm',
            '-v',
            '/var/run/docker.sock:/var/run/docker.sock'
        ];
        const cmdOptions = [];
        if (config) {
            runOptions.push('-v', `${config}:/.dive-ci`);
            cmdOptions.push('--ci-config', '/.dive-ci');
        }
        await exec.exec('docker', ['pull', dive]);
        const parameters = ['run', ...runOptions, dive, image, ...cmdOptions];
        let output = '';
        const execOptions = {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    output += data.toString();
                },
                stderr: (data) => {
                    output += data.toString();
                }
            }
        };
        const exitCode = await exec.exec('docker', parameters, execOptions);
        let results = extract(output);
        setActionOutput('efficiency', results.efficiency);
        setActionOutput('wasted-bytes', results.wastedBytes);
        setActionOutput('user-wasted-percent', results.userWastedPercent);
        if (exitCode === 0) {
            // success
            return;
        }
        if (exitZero === 'true') {
            // forced exit 0
            console.log(`Scan failed (exit code: ${exitCode}), but forcing exit with 0.`);
            return;
        }
        core.setFailed(`Scan failed (exit code: ${exitCode})`);
    }
    catch (error) {
        core.setFailed(`${error}`);
    }
}
run();
