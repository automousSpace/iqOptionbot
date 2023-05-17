
var webSocketServer = require('websocket').server;
var http = require('http');
const redis = require('redis');
const { promisify } = require('util');
var ws = require('ws');
var wss = new ws('wss://ws.km.iqoption.com/echo/websocket', [] , {'headers' : {   origin : 'https://km.iqoption.com' }});


let msgQueue = []
var ptr1_obj =
{
   data : [],
   isPattern : false,
   isGreenSequence : false,
   candleEndTimeTemp : '',
   baseLine : 0,
   numOfRed : 0,
   minRed : 2,
   time : 60
}
var addDataInMsgQueue =  async (data) =>
{
  if(msgQueue.length > 50)
  {
    msgQueue = []
  }
  console.log(data)
  msgQueue.push(data)
}
var getDatafromMsgQueue =  async () =>
{
  if(msgQueue.length > 0)
  {
    let msg = msgQueue[0]
    msgQueue.splice(0, 1);
    return msg
  }
  else
  return false
}
var pattern1ResetData =  async () =>
{
  ptr1_obj.isPattern = false
  ptr1_obj.isGreenSequence = false
  ptr1_obj.data = []
  ptr1_obj.baseLine = 0
  ptr1_obj.numOfRed = 0
}
var pattern1VolumeCompare =  async () =>
{
  let maxVol = 0
  let maxVolIndx = 0
  for (let i = 0; i < ptr1_obj.data.length; i++) 
  {
      if( ptr1_obj.data[i].volume > maxVol)
      {
        maxVolIndx = i
        maxVol =  ptr1_obj.data[i].volume
      }
      
  }

  if( maxVolIndx ==  ptr1_obj.data.length -1)
  {
    addDataInMsgQueue( " Max volume is of Last Candle ")
      return true
  }
  else
  {
    addDataInMsgQueue( " volume of index = " + maxVolIndx +" is greater ")
      return false
  }
}
var pattern1 =  async (msg) =>
{
  
  let candleEndTime = msg.to.toString()

  if(ptr1_obj.candleEndTimeTemp == '')
  {
    ptr1_obj.candleEndTimeTemp = candleEndTime
  }

  if(ptr1_obj.candleEndTimeTemp == candleEndTime)
  {
    ptr1_obj.oldCandle = msg
  }
  else
  {
      //console.log("  candle break .... ")
     // console.log(ptr1_obj.oldCandle)
       ptr1_obj.candleEndTimeTemp = candleEndTime
      if(ptr1_obj.oldCandle.close > ptr1_obj.oldCandle.open)
      {
        
        if(ptr1_obj.data.length == 0)
        {
          ptr1_obj.data.push(ptr1_obj.oldCandle)
          ptr1_obj.isPattern = true
          ptr1_obj.baseLine = ptr1_obj.oldCandle.open
          ptr1_obj.isGreenSequence = true
          addDataInMsgQueue(" Candle was ---> : Green, Pattern Started, BaseLine --->  " + ptr1_obj.baseLine)
        } 
        else
        {
          if( ptr1_obj.isGreenSequence == true)
          {
              ptr1_obj.data.push(ptr1_obj.oldCandle)
              addDataInMsgQueue(" Candle was ---> : Green , Still in Pattern ")
          }
          else
          {
              pattern1ResetData()
              ptr1_obj.isPattern = true
              ptr1_obj.baseLine = ptr1_obj.oldCandle.open
              ptr1_obj.isGreenSequence = true
              addDataInMsgQueue(" \n - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  ")
              addDataInMsgQueue(" \n Pattern Break : Green btw Reds, Started again, BaseLine --->  " + ptr1_obj.baseLine)
          }
        }

      }
      else
      {
      
        if(ptr1_obj.isPattern)
        {
          
          if( ptr1_obj.oldCandle.close > ptr1_obj.baseLine )
          {
            if( ptr1_obj.isGreenSequence == true )
            {
                // first red
                ptr1_obj.data.push(ptr1_obj.oldCandle)
                ptr1_obj.isGreenSequence = false
                ptr1_obj.numOfRed = 1
                addDataInMsgQueue(" First Red : In Pattern " )

            }
            else
            {
                
                ptr1_obj.numOfRed++
                if( ptr1_obj.numOfRed <= ptr1_obj.minRed)
                {
                    ptr1_obj.data.push(ptr1_obj.oldCandle)
                    addDataInMsgQueue(" Red : In Pattern -- putting in minimum list, minimun reds = " + ptr1_obj.minRed )
                }
                else
                {
                    //vol compare
                    let upperStickLen = ptr1_obj.oldCandle.min = ptr1_obj.oldCandle.open
                    let lowerStickLen = ptr1_obj.oldCandle.max = ptr1_obj.oldCandle.close
                    
                    if( lowerStickLen > upperStickLen)
                    {
                        if(await pattern1VolumeCompare())
                        {
                          addDataInMsgQueue(" <------- Purchase Now ------->")
                            pattern1ResetData()
                        }
                        else
                        {
                            addDataInMsgQueue(" Red : In Pattern -- Volume is less from others " )
                            ptr1_obj.data.push(ptr1_obj.oldCandle)
                        }

                    }
                    else
                    {
                        addDataInMsgQueue(" Red : In Pattern -- Lower stick length is not greater " )
                        ptr1_obj.data.push(ptr1_obj.oldCandle)
                    }
                    
                }
            }
          }
          else
          {
             pattern1ResetData()
             addDataInMsgQueue(" Pattern Break : Red cross the BaseLine  \n" )
             addDataInMsgQueue(" - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  \n" )
          }
        }
        else
        {
          addDataInMsgQueue(" Waiting for First Green to start Pattern ")
        }

      }
    
  }

}
var sendmessage = async () =>
{
  wss.on('open', function open() 
  {
    addDataInMsgQueue(" - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  \n" )
    addDataInMsgQueue(" Bot Activated");
   wss.send(`{"name":"authenticate","request_id":"1680360875_314499063","local_time":3509,"msg":{"ssid":"22f5a23ec63df3fbce918ed0aa745c7e","protocol":3,"session_id":"","client_session_id":""}}`);
    
  });

  wss.on('message', function incoming(messagee) 
  {
  // console.log('received 2 : ----------->> ', messagee.toString());
   wss.send(`{"name":"subscribeMessage","request_id":"s_204","local_time":1574272,"msg":{"name":"candle-generated","params":{"routingFilters":{"active_id":816,"size":60}}}}`);
   wss.send(`{"name":"heartbeat","request_id":"919","local_time":788967,"msg":{"userTime":"1680363980950","heartbeatTime":"1680363980950"}}`);
  //console.log('received 2 ');
    try
    {
        let data = JSON.parse(messagee)
        if(data.name)
        {
            if(data.name == 'candle-generated' && data.msg.active_id == 816)
            {
                pattern1(data.msg)
            }
            if(data.name == 'timeSync')
            {
              usertime = data.msg
            }
            if(data.name == 'heartbeat')
            {
              heartbeat = data.msg
            }
         
        }
    }
    catch
    {
      addDataInMsgQueue(" Error in message prase in 2 .. ")
    }
    
  });
  

}

var server = http.createServer(function(request, response) {
});
/**
* WebSocket server
*/
var wsServer = new webSocketServer({
  httpServer: server
});


const client = redis.createClient({
    host: '127.0.0.1' ,
    port: '6379'
  });

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

server.listen(3007, async() => {
  console.log(' Server is listening on port 3007');
  console.log(" Connected to Redis...");
  sendmessage()
});


wsServer.on( 'request', async function(request) {

 // console.log(' request ' + JSON.stringify(request));


  console.log(' New Connection ');

  var connection = request.accept(null, request.origin); 


  connection.on('message', async(message) =>{
    if (message.type === 'utf8') 
    {
      let msg = message.utf8Data
      msg = JSON.parse(msg)
      if(msg.name == 'ineedlog')
      {
        let tmpmsg = await getDatafromMsgQueue()
        if(tmpmsg)
        {
          let msgtoSend = 
          {
            name : 'hereislog',
            msg : tmpmsg
          }
          connection.send(JSON.stringify(msgtoSend));
        }
        
      }
    }
  });

  // user disconnected
  connection.on('close', function(connection) {
    console.log(" ---  Client closed --- ");
  });

});
