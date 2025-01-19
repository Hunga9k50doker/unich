import axios from "axios";
import log from "./utils/logger.js";
import bangToib from "./utils/banner.js";
import fs from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

// read tokens from file
async function readFile(file) {
  try {
    const fileContent = await fs.promises.readFile(file, "utf8");

    const data = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return data;
  } catch (error) {
    log.error(`Error reading ${file}: `, error.message);
  }
}

const newAgent = (proxy = null) => {
  if (proxy && proxy.startsWith("http://")) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy && (proxy.startsWith("socks4://") || proxy.startsWith("socks5://"))) {
    return new SocksProxyAgent(proxy);
  }
  return null;
};

// start mining
async function startMining(token, proxy) {
  const agent = newAgent(proxy);
  const url = "https://api.unich.com/airdrop/user/v1/mining/start";
  const payload = {};

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      agent: agent,
    });
    log.info(`Mining started successfully: ${JSON.stringify(response.data)}`);
  } catch (error) {
    log.error("Error starting mining:", error.response ? error.response.data : error.message);
  }
}

//fetch social tasks
async function getSocialListByUser(token, proxy) {
  const agent = newAgent(proxy);
  const url = "https://api.unich.com/airdrop/user/v1/social/list-by-user";

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      agent: agent,
    });
    return response.data.data;
  } catch (error) {
    log.error("Error fetching social list by user:", error.response ? error.response.data : error.message);
    return null;
  }
}

//fetch recent mining data
async function getRecentMining(token, proxy) {
  const agent = newAgent(proxy);
  const url = "https://api.unich.com/airdrop/user/v1/mining/recent";

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      agent: agent,
    });
    return response.data;
  } catch (error) {
    log.error("Error fetching recent mining data:", error.response ? error.response.data : error.message);
    return null;
  }
}

async function getRef(token, proxy) {
  const agent = newAgent(proxy);
  const url = "https://api.unich.com/airdrop/user/v1/ref";

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      agent: agent,
    });
    return response.data;
  } catch (error) {
    return null;
  }
}

async function addRef(token, proxy) {
  const agent = newAgent(proxy);
  const url = "https://api.unich.com/airdrop/user/v1/ref/refer-sign-up";

  try {
    const response = await axios.post(
      url,
      { code: "YL1FJT" },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        agent: agent,
      }
    );
    return response.data;
  } catch (error) {
    return null;
  }
}

async function claimSocialReward(token, taskId, proxy) {
  const agent = newAgent(proxy);
  const url = `https://api.unich.com/airdrop/user/v1/social/claim/${taskId}`;
  const payload = {
    evidence: taskId,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      agent: agent,
    });
    log.info(`Claim successful:  ${JSON.stringify(response.data)}`);
  } catch (error) {
    log.error("Error claiming reward:", error.response ? error.response.data : error.message);
  }
}

// Main function
async function start() {
  log.info(bangToib);
  const tokens = await readFile("tokens.txt");
  if (tokens.length === 0) {
    log.error("No tokens found in tokens.txt");
    return;
  }
  const proxies = await readFile("proxy.txt");
  const accountsProcessing = tokens.map(async (token, index) => {
    const proxy = proxies[index % proxies.length];
    while (true) {
      const refInfo = await getRef(token, proxy);
      if (!refInfo?.data?.referred) {
        await addRef(token, proxy);
      }
      const recent = await getRecentMining(token, proxy);
      const isMining = recent?.data?.isMining;
      const balance = recent?.data?.mUn;
      log.info(`Processing Account ${index + 1} with proxy: ${proxy || "No proxy"}`);
      log.info(`Account ${index + 1} | Mining : ${isMining} | Total Points : ${balance}`);

      if (!isMining) {
        await startMining(token, proxy);
      } else {
        log.info(`Account ${index + 1} | Mining already started.`);
      }

      const tasks = await getSocialListByUser(token, proxy);
      if (!tasks) return;

      const unclaimedIds = tasks.items.filter((item) => !item.claimed).map((item) => item.id);

      log.info(`Account ${index + 1} | Found ${unclaimedIds.length} Unclaimed tasks`);

      for (const taskId of unclaimedIds) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        log.info(`Account ${index + 1} | Trying to complete task ID: ${taskId}`);
        await claimSocialReward(token, taskId, proxy);
      }
      log.warn(`Completed account ${index + 1}. Waiting 24 hours before checking again...`);
      await new Promise((resolve) => setTimeout(resolve, 24 * 60 * 60 * 1000));
    }
  });

  await Promise.all(accountsProcessing);
}

// run
start();
