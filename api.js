// @see https://docs.aircode.io/guide/functions/
const xml2js = require('xml2js');
const axios = require('axios');

const { Configuration, OpenAIApi } = require("openai");
const { decrypt } = require('@wecom/crypto');

const { EncodingAESKey, OpenAIKey, CorpSecret, CorpId } = process.env;

// 转换 xml 格式数据
const parseXML = (data) => {

  const parser = new xml2js.Parser();

  return parser.parseStringPromise(data).then(function (result) {

    console.dir(result);
    return result;
  })
  .catch(function (err) {
    console.error(err);
  });    

};

// 从 buffer 格式数据获取消息内容
const getMessageFromBuffer = async (buf) => {

  try {

    // 将 buffer 数据转换成 string 格式数据
    const xmlData = buf.toString('utf8');
    const result = await parseXML(xmlData);

    const { xml } = result;
    const { Encrypt } = xml;
    // 解密数据
    const data = decrypt(EncodingAESKey, Encrypt[0]);
    const { message } = data;

    const content = await parseXML(message);

    console.log('转换 xml 格式数据: ', content.xml);
    return content.xml;
  
  } catch (error) {
    console.error('获取消息内容报错', error);
    return {
      message: `获取消息内容报错: ${error.message}`,
    }
  }
}


// 获取 access token https://developer.work.weixin.qq.com/document/path/91039
const getAccessToken = async () => {

  try {
    const { data } = await axios(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CorpId}&corpsecret=${CorpSecret}`);
    console.log('access token', data);
    const { errcode, access_token, errmsg } = data;

    if (errcode === 0 && errmsg === 'ok') {
      return access_token;
    } else {
      console.error(`获取 access token 报错:: ${errmsg}`);
      return {
        code: errcode,
        message: `获取 access token 报错: ${errmsg}`,
      }
    }
    
  } catch (error) {
    console.log('error', error);
    return {
      message: `获取 access token 未知报错: ${error.message}`,
    }
  }
  
}

// 回复信息 https://developer.work.weixin.qq.com/document/path/90236
const sendMessage = async (accessToken, { touser, msgtype, agentid, text }) => {

  try {
    const { data } = await axios({
      method: 'post',
      url: `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`,
      data: {
        touser,
        msgtype,
        agentid,
        text,
      },
    });
    const { errcode, errmsg } = data;
    console.log('回复消息数据: ', data);
    if (errcode === 0 && errmsg === 'ok') {
      console.log('成功回复消息');
    } else {
      console.error(`回复消息报错: ${errmsg}`);
      return {
        code: errcode,
        message: `回复消息报错: ${errmsg}`,
      }
    }
    
  } catch (error) {
    return {
      message: `回复消息未知报错: ${error.message}`,
    }
  }
}

// 使用 openAI 接口调用 ChatGPT
const getOpenAIChatCompletion = async (question) => {

  try {

    const configuration = new Configuration({
      apiKey: OpenAIKey,
    });

    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      // 使用当前 OpenAI 开放的最新 3.5 模型，如果后续 4 发布，则修改此处参数即可
      // OpenAI models 参数列表 https://platform.openai.com/docs/models
      model: "gpt-3.5-turbo",
      messages: [{ role: "assistant", content: question }],
    });

    console.log('ChatGPT completion 数据:', completion.data.choices[0].message.content.trim());
    return completion.data.choices[0].message.content.trim();

  } catch(error) {
  
    console.error(`OpenAI 接口报错: ${error.message}`);
    return {
      code: 1,
      message: `OpenAI 接口获取信息报错: ${error.message}`
    }
  }
}

module.exports = {
  getAccessToken,
  sendMessage,
  getMessageFromBuffer,
  getOpenAIChatCompletion,
}
