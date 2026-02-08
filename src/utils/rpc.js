const axios = require('axios');

function makeRpcClient(rpcHttpUrl) {
  let id = 1;
  return async function rpc(method, params) {
    const res = await axios.post(
      rpcHttpUrl,
      { jsonrpc: '2.0', id: id++, method, params },
      { timeout: 4000 }
    );
    if (res.data.error) throw new Error(JSON.stringify(res.data.error));
    return res.data.result;
  };
}

module.exports = { makeRpcClient };
