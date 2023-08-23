// @see https://docs.aircode.io/guide/functions/
const aircode = require('aircode');
const { decrypt, getSignature } = require('@wecom/crypto');

const { getAccessToken, sendMessage, getOpenAIChatCompletion, getMessageFromBuffer } = require('./api.js');

let preMessageId = '';

module.exports = async function(params, context) {

  const { method } = context;
  const { Token, OpenAIKey, EncodingAESKey } = process.env;

  // 检查环境变量是否成功设置
  const envVars = {
    CorpId: '请检查你的环境变量 CorpId 值, 请在 https://work.weixin.qq.com/wework_admin/frame#profile/enterprise 获取到企业ID',
    Token: '请检查你的环境变量 Token 值，请在后台应用详情页接收消息模块配置生成',
    EncodingAESKey: '请检查你的环境变量 EncodingAESKey 值，请在后台应用详情页接收消息模块配置生成',
    CorpSecret: '请检查你的环境变量 CorpSecret 值, 请在 https://work.weixin.qq.com/wework_admin/frame#apps) 获取到应用 Secret',
  };

  for (const [envVar, errorMessage] of Object.entries(envVars)) {
    if (!process.env[envVar]) {
      console.error(errorMessage);
      return {
        code: 1,
        message: errorMessage,
      };
    }
  };

  if (method === 'GET') {

    let { msg_signature, timestamp, nonce, echostr } = params;
  
    // 企业微信后台接收消息服务器地址配置验证
    if (echostr) {
  
      try {

        [msg_signature, timestamp, nonce, echostr] = [msg_signature, timestamp, nonce, echostr].map(decodeURIComponent);
  
        const signature = getSignature(Token, timestamp, nonce, echostr);

        if (signature !== msg_signature) {
          return {
            code: 1,
            message: `接收消息服务器地址配置验证错误: ${signature} !== ${msg_signature}`,
          }
        }
  
        const msg = decrypt(EncodingAESKey, echostr);
        return msg['message'];
      
      } catch (error) {
        console.error('接收消息服务器地址配置验证错误: ', error.message);
        return {
          code: 1,
          message: `接收消息服务器地址配置验证报错: ${error.message}`,
        }
      }
    }
  }

  // 回复用户信息
  if (method === 'POST') {

    const isBuffer = Buffer.isBuffer(params);

    if (isBuffer) {

      const message = await getMessageFromBuffer(params);

      if (message) {
        const { FromUserName, MsgType, AgentID, Content, MsgId } = message;

        // 企业微信会重复发送信息，这里如果 message ID 相同则不再处理回复
        const msgId = MsgId[0];
        if (msgId === preMessageId) {
          return
        }

        preMessageId = msgId;
        
        const accessToken = await getAccessToken();
        let messageContent = Content[0];

        if (OpenAIKey) {
          messageContent = await getOpenAIChatCompletion(messageContent);
        }

        if (!messageContent) {
          return {
            code: 1,
            message: '获取 ChatGPT 回答失败',
          };
        }
    
        const replyMessage = {
          touser: FromUserName[0],
          msgtype: MsgType[0],
          agentid: AgentID[0],
          text: {
            content: messageContent
          },
        }

        const res = await sendMessage(accessToken, replyMessage);
        return {
          code: 0,
          message: '成功回复用户信息'
        }
      }
    } else {
      return {
        code: 1,
        message: `请跟随教程 https://aircode.cool/54fhemjpk2 进行配置，在企业微信应用聊天框输入信息调试代码, 或通过 Debug 功能使用 Buffer 类型数据进行调试`,
      }
    }
  }
};