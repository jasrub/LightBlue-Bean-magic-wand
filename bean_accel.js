
"use strict";

var Bean = require('ble-bean');

var mpg321 = require('mpg321');

// Lights

var noble = require('noble');



var  serviceUUID =  '6e400001b5a3f393e0a9e50e24dcca9e'; //
var  txCharacteristicUuid = '6e400002b5a3f393e0a9e50e24dcca9e'; // transmit is from the phone's perspective
var  rxCharacteristicUuid = '6e400003b5a3f393e0a9e50e24dcca9e';// receive is from the phone's perspective

var lightsID = 'd96e8402b81742a490281c1d0e644e3a'


noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    console.log('scanning...');
    noble.startScanning([], false);
  }
  else {
    noble.stopScanning();
  }
})


var  lightService = null; //
var  lightTxCharacteristic = null; // transmit is from the phone's perspective
var  lightRxCharacteristic = null; // receive is from the phone's perspective

var lightsConnected = false;
var lightsOn = false;

noble.on('discover', function(peripheral) {

  console.log('found peripheral:', peripheral.advertisement);

  if (peripheral.id==lightsID) {
    console.log('matchID');
    noble.stopScanning();
    peripheral.connect(function(err) {
      console.log('connected!');
      console.log(peripheral.advertisement.localName)
 
    peripheral.discoverServices([serviceUUID], function(err, services) {
      services.forEach(function(service) {
 
        console.log('found service:', service.uuid);
 
        service.discoverCharacteristics([], function(err, characteristics) {

          characteristics.forEach(function(characteristic) {
 
            console.log('found characteristic:', characteristic.uuid);

            if (txCharacteristicUuid == characteristic.uuid) {
              lightTxCharacteristic = characteristic;
            }
            else if (rxCharacteristicUuid == characteristic.uuid) {
              lightRxCharacteristic = characteristic;
            }
          })
          if (lightRxCharacteristic &&
              lightTxCharacteristic) {
            console.log('lights connected!!');
            lightsConnected = true 
            var data = new Buffer("OFF");
            lightTxCharacteristic.write(data, false, function(err) {})
          }
          else {
            console.log('missing characteristics');
          }
        })
      })
    })
  })
}
})

function toggleLights(stringToWrite) {
  if (lightsConnected) {
    //var stringToWrite = lightsOn? "OFF": "ON"
    var data = new Buffer(stringToWrite);
    lightTxCharacteristic.write(data, false, function(err) {});
    lightsOn = !lightsOn;
  }
}
 
var file1 = 'drum_roll.mp3',
file2 = 'wand.mp3',
file3 = 'fart.mp3',
player = mpg321().remote();
player.on('end', function () {
          playing = false;
});

var d = new Date();
var wakeUpTimeStart = Date.now();

var START_THRESHOLD = 0.5;

var START_THRESHOLD_NUMBER = 8;

var intervalId;
var connectedBean;

var accelerateStartModel_x = 0;
var accelerateStartModel_z = 0;
var accelerateEndModel_x = 0;
var accelerateEndModel_z = 0;
var samplingIndex = 0;
var samplingAccelerateData = 0;
var calculatingAccelerateData = 0;

var numReadings = 20;
var readings = [];     // the readings from the accelerometer
var readIndex = 0;              // the index of the current reading

var highSpeedShakeCount = 0;

// wake up vars
var gestureWakeUp = 0;
var notMoveStartDetect = 0;
var notMoveStartCount = 0;

var playing = false;

var started = false;
var startCount= 0;
var actionNumber = -1;
var numActions = 7;

var isInCoolDown = false;

var connectedBean = null;

// initialize readings arrays
for (var i=0; i<numReadings; i++) {
  readings.push([0,0,0])
}

Bean.discover(function(bean){
  connectedBean = bean;
  process.on('SIGINT', exitHandler.bind(this));

  bean.setColor(new Buffer([0,0,0]),
    function(){
      console.log("led color sent");
    });

  bean.on("accell", function(x, y, z, valid){
    var status = valid ? "valid" : "invalid";
    if (valid) {
      var currReading = [x,y,z]
      readings.push(currReading);
      var removedReading = readings.shift();


      // updtae highSpeedCheckCount
      updateHighSpeedCount(removedReading, currReading)
      wakeUp();
      checkMoveStart();
    }
  });

  bean.on("disconnect", function(){
    process.exit();
  });

  bean.setMaxListeners(20);

  bean.connectAndSetup(function(){

    var readData = function() {

      bean.requestAccell(
      function(){
        //console.log("request accell sent");
      });
    }

    intervalId = setInterval(readData,25);

  });

});

function updateHighSpeedCount(removedReading, currentReading) {
  if ((Math.abs(removedReading[0]) > 1.5) || (Math.abs(removedReading[1]) > 1.5) || (Math.abs(removedReading[2]) > 1.5)) {
    highSpeedShakeCount-=1
  }
  if ((Math.abs(currentReading[0]) > 1.5) || (Math.abs(currentReading[1]) > 1.5) || (Math.abs(currentReading[2]) > 1.5)) {
    highSpeedShakeCount+=1
  }

}

function wakeUp() {
  if(highSpeedShakeCount < 2) {
    if(!notMoveStartDetect) {
      notMoveStartDetect = true;
    }
    notMoveStartCount++;
  } else {
    if(notMoveStartDetect) {
      notMoveStartDetect = false;
      notMoveStartCount = 0;
      wakeUpTimeStart = Date.now();
    }
  }
  if(notMoveStartDetect) {
    if(notMoveStartCount >= 2) {
      gestureWakeUp = 0;
      notMoveStartDetect = false;
      return;
    }
  }
  var timerEnd = Date.now();
  if(timerEnd - wakeUpTimeStart > 1000) {
    gestureWakeUp = 1;
    return;
  }  
}

var getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

function checkMoveStart()
{
  var thresholdCount = 0;
        for (var i=1; i<numReadings; i++) {
        if (Math.abs(readings[i][0]-readings[0][0]) + Math.abs(readings[i][2]-readings[0][2]) > START_THRESHOLD) {
            thresholdCount++;
            if(thresholdCount > START_THRESHOLD_NUMBER) {
                //console.log("start! "+started)
                //doAction()
                started = true;
                startCount++
                // samplingIndex = 0;
                // accelerateArray[samplingIndex][0] = x - accelerateStartModel_x;
                // accelerateArray[samplingIndex][1] = z - accelerateStartModel_z;
                // samplingAccelerateData = 1;
                return;
            }
        } else {
            if (started && startCount>=1 && !isInCoolDown) {
              isInCoolDown = true
              console.log("starting cool down")
              connectedBean.setColor(new Buffer([getRandomInt(0,64),getRandomInt(0,255),getRandomInt(0,255)]),
              function(){
                  console.log("led color sent");
              });
              doAction();
              setTimeout(function() {
                isInCoolDown = false
                console.log("cool down end")
                connectedBean.setColor(new Buffer([0,0,0]),
                  function(){
                  console.log("led color sent");
                 });
              }, 2000);

            }
           started = false;
           startCount = 0;
            return;
        }
      }
    //}
    return;
}

function doAction() {
  actionNumber++;
  if (actionNumber>=numActions) {
    actionNumber = 0
  }
  //console.log("in action "+actionNumber);
  switch (actionNumber){
  case 0: {
    player.play(file1);
    return;
    //playing = true
  }
  case 1: {
    toggleLights("ON")
    return;

  }
  case 2: {
    toggleLights("FADE");
    player.play(file2);
    return;

  }
  case 3: {
    toggleLights("OFF");
    return;

  }
  case 4: {
    player.play(file3);
    return;

  }
  case 5: {
    toggleLights("FADE");
    return;

  }
  case 6: {
    toggleLights("OFF");
    return;

  }
}
}


process.stdin.resume();//so the program will not close instantly
var triedToExit = false;

//turns off led before disconnecting
var exitHandler = function exitHandler() {

  var self = this;
  if (connectedBean && !triedToExit) {
    triedToExit = true;
    //console.log('Turning off led...');
    clearInterval(intervalId);
    connectedBean.setColor(new Buffer([0x0,0x0,0x0]), function(){});
    //no way to know if succesful but often behind other commands going out, so just wait 2 seconds
    console.log('Disconnecting from Device...');
    setTimeout(connectedBean.disconnect.bind(connectedBean, function(){}), 2000);
  } else {
    process.exit();
  }
};