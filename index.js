const { ethers } = require('ethers');
const axios = require('axios');
const chalk = require('chalk');
const moment = require('moment-timezone');
const fs = require('fs');

const referralCode = "apCgykb5GMNW";

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function delayTenSeconds() {
  console.log(chalk.bold.yellowBright('Menunggu 10 detik sebelum memulai kembali...'));
  return delay(10000); // 10 detik
}

const rpcUrl = 'https://rpc.ankr.com/taiko';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return wallet;
}

function saveWalletToFile(wallet) {
  const address = wallet.address;
  const privateKey = wallet.privateKey;
  const data = `${address}|${privateKey}\n`;
  fs.appendFileSync('cyberDua.txt', data);
}

async function postAddress(address, wallet) {
  console.log(chalk.bold.yellowBright('Sedang daftar cyber...'));
  await delay(2000);
  const apiEndpoint = 'https://auth.privy.io/api/v1/siwe/init';
  const headers = {
    'Content-Type': 'application/json',
    'Privy-App-Id': 'clphlvsh3034xjw0fvs59mrdc',
    'Origin': 'https://cyber.deform.cc',
    'User-Agent': 'PostmanRuntime/7.39.0'
  };
  const payload = { address };

  try {
    const response = await axios.post(apiEndpoint, payload, { headers });
    const responseData = response.data;

    const expiresAtUTC = responseData.expires_at;
    const expiresAtJakarta = moment(expiresAtUTC).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
    console.log(
      chalk.greenBright(`nonce: ${responseData.nonce}\n`) +
      chalk.greenBright(`Address: ${responseData.address}\n`) +
      chalk.greenBright(`Expired: ${expiresAtJakarta} (Asia/Jakarta)\n`)
    );

    await signMessageAndAuthenticate(responseData.nonce, address, wallet);
  } catch (error) {
    console.error('Error posting address:', error);
  }
}

async function signMessageAndAuthenticate(nonce, address, wallet) {
  console.log(chalk.bold.yellowBright('Sign Message...'));
  await delay(3000);
  const message = `cyber.deform.cc wants you to sign in with your Ethereum account:\n${address}\n\nBy signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.\n\nURI: https://cyber.deform.cc\nVersion: 1\nChain ID: 18071918\nNonce: ${nonce}\nIssued At: ${moment().toISOString()}\nResources:\n- https://privy.io`;
  const signature = await wallet.signMessage(message);

  const apiEndpoint = 'https://auth.privy.io/api/v1/siwe/authenticate';
  const headers = {
    'Content-Type': 'application/json',
    'Privy-App-Id': 'clphlvsh3034xjw0fvs59mrdc',
    'Origin': 'https://cyber.deform.cc',
    'User-Agent': 'PostmanRuntime/7.39.0'
  };
  const payload = {
    message: message,
    signature: signature,
    chainId: "eip155:18071918",
    walletClientType: "okx_wallet",
    connectorType: "injected"
  };

  try {
    const response = await axios.post(apiEndpoint, payload, { headers });
    const responseData = response.data;

    const createdAt = moment.unix(responseData.user.created_at).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');

    console.log(
      chalk.magentaBright(`ID: ${responseData.user.id}\n`) +
      chalk.magentaBright(`Register Date: ${createdAt} (Asia/Jakarta)\n`) +
      chalk.magentaBright(`Done Accept Terms: ${responseData.user.has_accepted_terms}\n`) +
      chalk.magentaBright(`New User: ${responseData.is_new_user}\n`) +
      chalk.magentaBright(`Token: ${responseData.token}\n`) +
      chalk.magentaBright(`Refresh Token: ${responseData.refresh_token}\n`) +
      chalk.magentaBright(`Session: ${responseData.session_update_action}\n`)
    );

    await acceptTerms(responseData.token);
    const loginToken = await getLoginToken(responseData.token);
    await bindReferral(loginToken);
    await clearMission(loginToken);
  } catch (error) {
    console.error('Error authenticating:', error);
  }
}

async function acceptTerms(token) {
  console.log(chalk.bold.yellowBright('Sedang Accept Terms...'));
  await delay(2000);
  const apiEndpoint = 'https://auth.privy.io/api/v1/users/me/accept_terms';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Privy-App-Id': 'clphlvsh3034xjw0fvs59mrdc',
    'Origin': 'https://cyber.deform.cc',
    'User-Agent': 'PostmanRuntime/7.39.0'
  };

  try {
    const response = await axios.post(apiEndpoint, {}, { headers });
    const responseData = response.data;

    console.log(
      chalk.blueBright(`ID: ${responseData.id}\n`) +
      chalk.blueBright(`Created At: ${moment.unix(responseData.created_at).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')} (Asia/Jakarta)\n`) +
      chalk.blueBright(`Address: ${responseData.linked_accounts[0].address}\n`) +
      chalk.blueBright(`Latest Verified At: ${moment.unix(responseData.linked_accounts[0].latest_verified_at).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')} (Asia/Jakarta)\n`) +
      chalk.blueBright(`Has Accepted Terms: ${responseData.has_accepted_terms}\n`)
    );
  } catch (error) {
    console.error('Error accepting terms:', error);
  }
}

async function getLoginToken(token) {
  console.log(chalk.bold.yellowBright('Mendapatkan token login untuk bind reff dan clear misi...'));
  await delay(1500);
  const apiEndpoint = 'https://api.deform.cc/';
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://cyber.deform.cc',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'X-Apollo-Operation-Name': 'UserLogin'
  };

  const payloadGetLogin = {
    "operationName": "UserLogin",
    "variables": {
      "data": {
        "externalAuthToken": token
      }
    },
    "query": "mutation UserLogin($data: UserLoginInput!) {\n  userLogin(data: $data)\n}"
  };

  try {
    const response = await axios.post(apiEndpoint, payloadGetLogin, { headers });
    const responseData = response.data;

    console.log(
      chalk.cyanBright(`Response: ${responseData.data.userLogin}`)
    );

    return responseData.data.userLogin;
  } catch (error) {
    console.error('Error getting login token:', error);
  }
}

async function bindReferral(token) {
  console.log(chalk.bold.yellowBright('Sedang Bind Referral...'));
  await delay(2000);
  const apiEndpoint = 'https://api.deform.cc/';
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://cyber.deform.cc',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  };

  const payload = {
    "operationName": "VerifyActivity",
    "variables": {
      "data": {
        "activityId": "43692233-3053-4d3c-ba15-b8bec55b5982",
        "metadata": {
          "referralCode": referralCode
        }
      }
    },
    "query": "mutation VerifyActivity($data: VerifyActivityInput!) {\n  verifyActivity(data: $data) {\n    record {\n      id\n      status\n      createdAt\n      __typename\n    }\n    __typename\n  }\n}"
  };

  try {
    const response = await axios.post(apiEndpoint, payload, { headers });
    const responseData = response.data;

    console.log(
      chalk.greenBright(`ID: ${responseData.data.verifyActivity.record.id}\nStatus: ${responseData.data.verifyActivity.record.status}`)
    );
  } catch (error) {
    console.error('Error Bind Referral:', error);
  }
}

async function clearMission(token) {
  console.log(chalk.bold.yellowBright('Clearing mission...'));
  await delay(2000);
  const apiEndpoint = 'https://api.deform.cc/';
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://cyber.deform.cc',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  };

  const payload = {
    "operationName": "VerifyActivity",
    "variables": {
      "data": {
        "activityId": "abce3636-8b96-40f8-8a69-06cb2e5d1823"
      }
    },
    "query": "mutation VerifyActivity($data: VerifyActivityInput!) {\n  verifyActivity(data: $data) {\n    record {\n      id\n      status\n      createdAt\n      __typename\n    }\n    __typename\n  }\n}"
  };

  try {
    const response = await axios.post(apiEndpoint, payload, { headers });
    const responseData = response.data;

    console.log(
      chalk.greenBright(`ID: ${responseData.data.verifyActivity.record.id}\nStatus: ${responseData.data.verifyActivity.record.status}`)
    );
  } catch (error) {
    console.error('Error clearing mission:', error);
  }
}

async function main() {
  console.log(chalk.bold.yellowBright('Membuat wallet baru...'));
  await delay(1000);
  const wallet = createWallet();
  saveWalletToFile(wallet);
  const address = wallet.address;
  console.log(chalk.greenBright(`Wallet address: ${address}`));
  await postAddress(address, wallet);
}

async function run() {
  while (true) {
    await main();
    console.log(chalk.bold.yellowBright('Menunggu 10 detik sebelum memulai kembali...'));
    await delay(10000); // Delay 10 detik sebelum menjalankan lagi
  }
}

run().catch(error => console.error('Error in main loop:', error));
