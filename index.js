const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { execSync } = require('child_process');
const UPLOAD_URL = process.env.UPLOAD_URL || '';
const PROJECT_URL = process.env.PROJECT_URL || '';
const AUTO_ACCESS = process.env.AUTO_ACCESS || false;
const FILE_PATH = process.env.FILE_PATH || './tmp';
const SUB_PATH = process.env.SUB_PATH || 'sub';
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const KAMAN = process.env.KAMAN || '9afd1229-b893-40c1-84dd-51e7ce204913';
const YOUNGHERO_SERVER = process.env.YOUNGHERO_SERVER || '';
const YOUNGHERO_PORT = process.env.YOUNGHERO_PORT || '';
const YOUNGHERO_KEY = process.env.YOUNGHERO_KEY || '';
const SUIDAO_DOMAIN = process.env.SUIDAO_DOMAIN || '';
const SUIDAO_AUTH = process.env.SUIDAO_AUTH || '';
const SUIDAO_PORT = process.env.SUIDAO_PORT || 8001;
const CFIP = process.env.CFIP || 'www.visa.com.sg';
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || 'Vls';

if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
  console.log(`${FILE_PATH} is created`);
} else {
  console.log(`${FILE_PATH} already exists`);
}

let npmPath = path.join(FILE_PATH, 'npm');
let phpPath = path.join(FILE_PATH, 'php');
let webPath = path.join(FILE_PATH, 'web');
let botPath = path.join(FILE_PATH, 'bot');
let subPath = path.join(FILE_PATH, 'sub.txt');
let listPath = path.join(FILE_PATH, 'list.txt');
let bootLogPath = path.join(FILE_PATH, 'boot.log');
let configPath = path.join(FILE_PATH, 'config.json');

function deleteNodes() {
  try {
    if (!UPLOAD_URL) return;
    if (!fs.existsSync(subPath)) return;

    let fileContent;
    try {
      fileContent = fs.readFileSync(subPath, 'utf-8');
    } catch {
      return null;
    }

    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line => 
      /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
    );

    if (nodes.length === 0) return;

    return axios.post(`${UPLOAD_URL}/api/delete-nodes`, 
      JSON.stringify({ nodes }),
      { headers: { 'Content-Type': 'application/json' } }
    ).catch((error) => { 
      return null; 
    });
  } catch (err) {
    return null;
  }
}

function cleanupOldFiles() {
  const pathsToDelete = ['web', 'bot', 'npm', 'php', 'sub.txt', 'boot.log'];
  pathsToDelete.forEach(file => {
    const filePath = path.join(FILE_PATH, file);
    fs.unlink(filePath, () => {});
  });
}

app.get("/", function(req, res) {
  res.send("Hello world!");
});

const config = {
  log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
  inbounds: [
    { port: SUIDAO_PORT, protocol: 'vless', settings: { clients: [{ id: KAMAN, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: 3001 }, { path: "/vless-suidao", dest: 3002 }, { path: "/vmess-suidao", dest: 3003 }, { path: "/trojan-suidao", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
    { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: KAMAN }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
    { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: KAMAN, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-suidao" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
    { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: KAMAN, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-suidao" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
    { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: KAMAN }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-suidao" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
  ],
  dns: { servers: ["https+local://8.8.8.8/dns-query"] },
  outbounds: [ { protocol: "freedom", tag: "direct" }, {protocol: "blackhole", tag: "block"} ]
};
fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config, null, 2));

function getSystemArchitecture() {
  const arch = os.arch();
  if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
    return 'arm';
  } else {
    return 'amd';
  }
}

function downloadFile(fileName, fileUrl, callback, retries = 3, delay = 3000) {
  const filePath = path.join(FILE_PATH, fileName);
  const writer = fs.createWriteStream(filePath);

  console.log(`Downloading ${fileName} from ${fileUrl}, attempt ${4-retries}/3`);

  axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
    timeout: 10000 // 10秒超时
  })
    .then(response => {
      response.data.pipe(writer);

      writer.on('finish', () => {
        writer.close();
        console.log(`Download ${fileName} successfully`);
        callback(null, fileName);
      });

      writer.on('error', err => {
        fs.unlink(filePath, () => { });
        const errorMessage = `Download ${fileName} failed: ${err.message}`;
        console.error(errorMessage);
        
        if (retries > 0) {
          console.log(`Retrying download ${fileName} in ${delay/1000} seconds... (${retries} attempts left)`);
          setTimeout(() => {
            downloadFile(fileName, fileUrl, callback, retries - 1, delay);
          }, delay);
        } else {
          callback(errorMessage);
        }
      });
    })
    .catch(err => {
      const errorMessage = `Download ${fileName} failed: ${err.message}`;
      console.error(errorMessage);
      
      if (retries > 0) {
        console.log(`Retrying download ${fileName} in ${delay/1000} seconds... (${retries} attempts left)`);
        setTimeout(() => {
          downloadFile(fileName, fileUrl, callback, retries - 1, delay);
        }, delay);
      } else {
        callback(errorMessage);
      }
    });
}

async function downloadFilesAndRun() {
  const architecture = getSystemArchitecture();
  const filesToDownload = getFilesForArchitecture(architecture);

  if (filesToDownload.length === 0) {
    console.log(`Can't find a file for the current architecture`);
    return;
  }

  const downloadPromises = filesToDownload.map(fileInfo => {
    return new Promise((resolve, reject) => {
      downloadFile(fileInfo.fileName, fileInfo.fileUrl, (err, fileName) => {
        if (err && fileInfo.backupUrls && fileInfo.backupUrls.length > 0) {
          console.log(`Primary download failed for ${fileInfo.fileName}, trying backup URLs...`);
          
          let backupIndex = 0;
          const tryBackupUrl = () => {
            if (backupIndex >= fileInfo.backupUrls.length) {
              reject(`All download attempts failed for ${fileInfo.fileName}`);
              return;
            }
            
            const backupUrl = fileInfo.backupUrls[backupIndex];
            console.log(`Trying backup URL ${backupIndex + 1}/${fileInfo.backupUrls.length}: ${backupUrl}`);
            
            downloadFile(fileInfo.fileName, backupUrl, (backupErr, backupFileName) => {
              if (backupErr) {
                backupIndex++;
                tryBackupUrl();
              } else {
                resolve(backupFileName);
              }
            }, 2);
          };
          
          tryBackupUrl();
        } else if (err) {
          reject(err);
        } else {
          resolve(fileName);
        }
      });
    });
  });

  try {
    await Promise.all(downloadPromises);
  } catch (err) {
    console.error('Error downloading files:', err);
    return;
  }
  function authorizeFiles(filePaths) {
    const newPermissions = 0o775;
    filePaths.forEach(relativeFilePath => {
      const absoluteFilePath = path.join(FILE_PATH, relativeFilePath);
      if (fs.existsSync(absoluteFilePath)) {
        fs.chmod(absoluteFilePath, newPermissions, (err) => {
          if (err) {
            console.error(`Empowerment failed for ${absoluteFilePath}: ${err}`);
          } else {
            console.log(`Empowerment success for ${absoluteFilePath}: ${newPermissions.toString(8)}`);
          }
        });
      }
    });
  }
  const filesToAuthorize = YOUNGHERO_PORT ? ['./npm', './web', './bot'] : ['./php', './web', './bot'];
  authorizeFiles(filesToAuthorize);

  if (YOUNGHERO_SERVER && YOUNGHERO_KEY) {
    if (!YOUNGHERO_PORT) {
      const port = YOUNGHERO_SERVER.includes(':') ? YOUNGHERO_SERVER.split(':').pop() : '';
      const tlsPorts = new Set(['443', '8443', '2096', '2087', '2083', '2053']);
      const youngherotls = tlsPorts.has(port) ? 'true' : 'false';
      const configYaml = `
client_secret: ${YOUNGHERO_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: false
ip_report_period: 1800
report_delay: 1
server: ${YOUNGHERO_SERVER}
skip_connection_count: false
skip_procs_count: false
temperature: false
tls: ${youngherotls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${KAMAN}`;
      
      fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), configYaml);
      
      const command = `nohup ${FILE_PATH}/php -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`;
      try {
        await exec(command);
        console.log('php is running');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`php running error: ${error}`);
      }
    } else {
      let YOUNGHERO_TLS = '';
      const tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
      if (tlsPorts.includes(YOUNGHERO_PORT)) {
        YOUNGHERO_TLS = '--tls';
      }
      const command = `nohup ${FILE_PATH}/npm -s ${YOUNGHERO_SERVER}:${YOUNGHERO_PORT} -p ${YOUNGHERO_KEY} ${YOUNGHERO_TLS} >/dev/null 2>&1 &`;
      try {
        await exec(command);
        console.log('npm is running');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`npm running error: ${error}`);
      }
    }
  } else {
    console.log('YOUNGHERO variable is empty,skip running');
  }
  const command1 = `nohup ${FILE_PATH}/web -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`;
  try {
    await exec(command1);
    console.log('web is running');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`web running error: ${error}`);
  }

  if (fs.existsSync(path.join(FILE_PATH, 'bot'))) {
    let args;

    if (SUIDAO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${SUIDAO_AUTH}`;
    } else if (SUIDAO_AUTH.match(/TunnelSecret/)) {
      args = `tunnel --edge-ip-version auto --config ${FILE_PATH}/tunnel.yml run`;
    } else {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${SUIDAO_PORT}`;
    }

    try {
      await exec(`nohup ${FILE_PATH}/bot ${args} >/dev/null 2>&1 &`);
      console.log('bot is running');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error executing command: ${error}`);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));

}

function getFilesForArchitecture(architecture) {
  let baseFiles;
  if (architecture === 'arm') {
    baseFiles = [
      { 
        fileName: "web", 
        fileUrl: "https://arm64.ssss.nyc.mn/web",
        backupUrls: ["https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-arm64-v8a.zip"]
      },
      { 
        fileName: "bot", 
        fileUrl: "https://arm64.ssss.nyc.mn/2go",
        backupUrls: ["https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"]
      }
    ];
  } else {
    baseFiles = [
      { 
        fileName: "web", 
        fileUrl: "https://amd64.ssss.nyc.mn/web",
        backupUrls: ["https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip"] 
      },
      { 
        fileName: "bot", 
        fileUrl: "https://amd64.ssss.nyc.mn/2go",
        backupUrls: ["https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"]
      }
    ];
  }

  if (YOUNGHERO_SERVER && YOUNGHERO_KEY) {
    if (YOUNGHERO_PORT) {
      const npmUrl = architecture === 'arm' 
        ? "https://arm64.ssss.nyc.mn/agent"
        : "https://amd64.ssss.nyc.mn/agent";
        baseFiles.unshift({ 
          fileName: "npm", 
          fileUrl: npmUrl,
          backupUrls: ["https://github.com/nezhahq/agent/releases/latest/download/nezha-agent_linux_" + (architecture === 'arm' ? "arm64" : "amd64") + ".zip"]
        });
    } else {
      const phpUrl = architecture === 'arm' 
        ? "https://arm64.ssss.nyc.mn/v1" 
        : "https://amd64.ssss.nyc.mn/v1";
      baseFiles.unshift({ 
        fileName: "php", 
        fileUrl: phpUrl,
        backupUrls: ["https://github.com/nezhahq/agent/releases/latest/download/nezha-agent_linux_" + (architecture === 'arm' ? "arm64" : "amd64") + ".zip"]
      });
    }
  }

  return baseFiles;
}

function suidaoType() {
  if (!SUIDAO_AUTH || !SUIDAO_DOMAIN) {
    console.log("SUIDAO_DOMAIN or SUIDAO_AUTH variable is empty, use quick tunnels");
    return;
  }

  if (SUIDAO_AUTH.includes('TunnelSecret')) {
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.json'), SUIDAO_AUTH);
    const tunnelYaml = `
  tunnel: ${SUIDAO_AUTH.split('"')[11]}
  credentials-file: ${path.join(FILE_PATH, 'tunnel.json')}
  protocol: http2
  
  ingress:
    - hostname: ${SUIDAO_DOMAIN}
      service: http://localhost:${SUIDAO_PORT}
      originRequest:
        noTLSVerify: true
    - service: http_status:404
  `;
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.yml'), tunnelYaml);
  } else {
    console.log("SUIDAO_AUTH mismatch TunnelSecret,use token connect to tunnel");
  }
}
suidaoType();

async function extractDomains() {
  let suidaoDomain;

  if (SUIDAO_AUTH && SUIDAO_DOMAIN) {
    suidaoDomain = SUIDAO_DOMAIN;
    console.log('SUIDAO_DOMAIN:', suidaoDomain);
    await generateLinks(suidaoDomain);
  } else {
    try {
      const fileContent = fs.readFileSync(path.join(FILE_PATH, 'boot.log'), 'utf-8');
      const lines = fileContent.split('\n');
      const suidaoDomains = [];
      lines.forEach((line) => {
        const domainMatch = line.match(/https?:\/\/([^ ]*trycloudflare\.com)\/?/);
        if (domainMatch) {
          const domain = domainMatch[1];
          suidaoDomains.push(domain);
        }
      });

      if (suidaoDomains.length > 0) {
        suidaoDomain = suidaoDomains[0];
        console.log('SuidaoDomain:', suidaoDomain);
        await generateLinks(suidaoDomain);
      } else {
        console.log('SuidaoDomain not found, re-running bot to obtain SuidaoDomain');
        fs.unlinkSync(path.join(FILE_PATH, 'boot.log'));
        async function killBotProcess() {
          try {
            await exec('pkill -f "[b]ot" > /dev/null 2>&1');
          } catch (error) {
          }
        }
        killBotProcess();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${SUIDAO_PORT}`;
        try {
          await exec(`nohup ${path.join(FILE_PATH, 'bot')} ${args} >/dev/null 2>&1 &`);
          console.log('bot is running.');
          await new Promise((resolve) => setTimeout(resolve, 3000));
          await extractDomains();
        } catch (error) {
          console.error(`Error executing command: ${error}`);
        }
      }
    } catch (error) {
      console.error('Error reading boot.log:', error);
    }
  }

  async function generateLinks(suidaoDomain) {
    const metaInfo = execSync(
      'curl -s https://speed.cloudflare.com/meta | awk -F\\" \'{print $26"-"$18}\' | sed -e \'s/ /_/g\'',
      { encoding: 'utf-8' }
    );
    const ISP = metaInfo.trim();

    return new Promise((resolve) => {
      setTimeout(() => {
        const VMESS = { v: '2', ps: `${NAME}-${ISP}`, add: CFIP, port: CFPORT, id: KAMAN, aid: '0', scy: 'none', net: 'ws', type: 'none', host: suidaoDomain, path: '/vmess-suidao?ed=2560', tls: 'tls', sni: suidaoDomain, alpn: '' };
        const subTxt = `
vless://${KAMAN}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${suidaoDomain}&type=ws&host=${suidaoDomain}&path=%2Fvless-suidao%3Fed%3D2560#${NAME}-${ISP}
  
vmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}
  
trojan://${KAMAN}@${CFIP}:${CFPORT}?security=tls&sni=${suidaoDomain}&type=ws&host=${suidaoDomain}&path=%2Ftrojan-suidao%3Fed%3D2560#${NAME}-${ISP}
    `;
        console.log(Buffer.from(subTxt).toString('base64'));
        fs.writeFileSync(subPath, Buffer.from(subTxt).toString('base64'));
        console.log(`${FILE_PATH}/sub.txt saved successfully`);
        uplodNodes();
        app.get(`/${SUB_PATH}`, (req, res) => {
          const encodedContent = Buffer.from(subTxt).toString('base64');
          res.set('Content-Type', 'text/plain; charset=utf-8');
          res.send(encodedContent);
        });
        resolve(subTxt);
      }, 2000);
    });
  }
}

async function uplodNodes() {
  if (UPLOAD_URL && PROJECT_URL) {
    const subscriptionUrl = `${PROJECT_URL}/${SUB_PATH}`;
    const jsonData = {
      subscription: [subscriptionUrl]
    };
    try {
        const response = await axios.post(`${UPLOAD_URL}/api/add-subscriptions`, jsonData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 200) {
            console.log('Subscription uploaded successfully');
        } else {
          return null;
        }
    } catch (error) {
        if (error.response) {
            if (error.response.status === 400) {
            }
        }
    }
  } else if (UPLOAD_URL) {
      if (!fs.existsSync(listPath)) return;
      const content = fs.readFileSync(listPath, 'utf-8');
      const nodes = content.split('\n').filter(line => /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line));

      if (nodes.length === 0) return;

      const jsonData = JSON.stringify({ nodes });

      try {
          await axios.post(`${UPLOAD_URL}/api/add-nodes`, jsonData, {
              headers: { 'Content-Type': 'application/json' }
          });
          if (response.status === 200) {
            console.log('Subscription uploaded successfully');
        } else {
            return null;
        }
      } catch (error) {
          return null;
      }
  } else {
      return;
  }
}

function cleanFiles() {
  // 首先设置一个较短的定时器，只输出日志但不删除文件，确保程序稳定运行
  setTimeout(() => {
    console.log('App is running');
    console.log('Thank you for using this script, enjoy!');
  }, 90000); // 90秒后输出日志
  
  // 设置一个较长的定时器，在程序稳定运行一段时间后删除文件
  setTimeout(() => {
    console.log('Performing delayed cleanup for privacy...');
    
    // 创建临时目录用于保存必要文件的备份
    const backupDir = path.join(FILE_PATH, '.backup');
    if (!fs.existsSync(backupDir)) {
      try {
        fs.mkdirSync(backupDir);
      } catch (error) {
        console.error('Failed to create backup directory:', error);
        return;
      }
    }
    
    // 备份关键配置文件
    try {
      if (fs.existsSync(configPath)) {
        fs.copyFileSync(configPath, path.join(backupDir, 'config.json'));
      }
      if (fs.existsSync(path.join(FILE_PATH, 'config.yaml'))) {
        fs.copyFileSync(path.join(FILE_PATH, 'config.yaml'), path.join(backupDir, 'config.yaml'));
      }
      if (fs.existsSync(path.join(FILE_PATH, 'tunnel.yml'))) {
        fs.copyFileSync(path.join(FILE_PATH, 'tunnel.yml'), path.join(backupDir, 'tunnel.yml'));
      }
      if (fs.existsSync(path.join(FILE_PATH, 'tunnel.json'))) {
        fs.copyFileSync(path.join(FILE_PATH, 'tunnel.json'), path.join(backupDir, 'tunnel.json'));
      }
    } catch (error) {
      console.error('Failed to backup configuration files:', error);
    }
    
    // 定义要删除的文件列表
    const filesToDelete = [webPath, botPath, phpPath, npmPath];
    
    // 执行删除操作
    exec(`rm -rf ${filesToDelete.join(' ')} >/dev/null 2>&1`, (error) => {
      if (error) {
        console.error('Error during delayed cleanup:', error);
      } else {
        console.log('Delayed cleanup completed successfully');
      }
    });
  }, 3600000); // 1小时后执行清理
}
cleanFiles();

async function AddVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) {
    console.log("Skipping adding automatic access task");
    return;
  }

  try {
    const response = await axios.post('https://oooo.serv00.net/add-url', {
      url: PROJECT_URL
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`automatic access task added successfully`);
  } catch (error) {
    console.error(`添加URL失败: ${error.message}`);
  }
}

// 添加进程监控和自动重启功能
async function monitorAndRestartProcesses() {
  console.log('Starting process monitoring service...');
  
  // 检查进程是否在运行的函数
  async function isProcessRunning(processName) {
    try {
      const { stdout } = await exec(`ps aux | grep ${processName} | grep -v grep`);
      return stdout.trim() !== '';
    } catch (error) {
      return false;
    }
  }

  // 定期检查并重启进程
  setInterval(async () => {
    // 检查 web 进程
    if (fs.existsSync(path.join(FILE_PATH, 'web'))) {
      const webRunning = await isProcessRunning(`${FILE_PATH}/web`);
      if (!webRunning) {
        console.log('Web process not running, restarting...');
        try {
          await exec(`nohup ${FILE_PATH}/web -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`);
          console.log('Web process restarted successfully');
        } catch (error) {
          console.error('Failed to restart web process:', error);
        }
      }
    }

    // 检查 bot 进程
    if (fs.existsSync(path.join(FILE_PATH, 'bot'))) {
      const botRunning = await isProcessRunning(`${FILE_PATH}/bot`);
      if (!botRunning) {
        console.log('Bot process not running, restarting...');
        let args;
        if (SUIDAO_AUTH && SUIDAO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
          args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${SUIDAO_AUTH}`;
        } else if (SUIDAO_AUTH && SUIDAO_AUTH.match(/TunnelSecret/)) {
          args = `tunnel --edge-ip-version auto --config ${FILE_PATH}/tunnel.yml run`;
        } else {
          args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${SUIDAO_PORT}`;
        }
        
        try {
          await exec(`nohup ${FILE_PATH}/bot ${args} >/dev/null 2>&1 &`);
          console.log('Bot process restarted successfully');
        } catch (error) {
          console.error('Failed to restart bot process:', error);
        }
      }
    }

    // 检查 php 或 npm 进程
    if (YOUNGHERO_SERVER && YOUNGHERO_KEY) {
      if (YOUNGHERO_PORT && fs.existsSync(path.join(FILE_PATH, 'npm'))) {
        const npmRunning = await isProcessRunning(`${FILE_PATH}/npm`);
        if (!npmRunning) {
          console.log('Npm process not running, restarting...');
          let YOUNGHERO_TLS = '';
          const tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
          if (tlsPorts.includes(YOUNGHERO_PORT)) {
            YOUNGHERO_TLS = '--tls';
          }
          try {
            await exec(`nohup ${FILE_PATH}/npm -s ${YOUNGHERO_SERVER}:${YOUNGHERO_PORT} -p ${YOUNGHERO_KEY} ${YOUNGHERO_TLS} >/dev/null 2>&1 &`);
            console.log('Npm process restarted successfully');
          } catch (error) {
            console.error('Failed to restart npm process:', error);
          }
        }
      } else if (fs.existsSync(path.join(FILE_PATH, 'php'))) {
        const phpRunning = await isProcessRunning(`${FILE_PATH}/php`);
        if (!phpRunning) {
          console.log('Php process not running, restarting...');
          try {
            await exec(`nohup ${FILE_PATH}/php -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`);
            console.log('Php process restarted successfully');
          } catch (error) {
            console.error('Failed to restart php process:', error);
          }
        }
      }
    }
  }, 60000); // 每分钟检查一次
}

// 修改 startserver 函数，添加进程监控
async function startserver() {
  deleteNodes();
  cleanupOldFiles();
  await downloadFilesAndRun();
  await extractDomains();
  AddVisitTask();
  
  // 启动进程监控
  monitorAndRestartProcesses();
}
startserver();

app.listen(PORT, () => console.log(`http server is running on port:${PORT}!`));
