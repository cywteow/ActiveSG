require("dotenv").config();
const puppeteer = require("puppeteer");
var fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

let context;
let browser
let previousMsg = ''
let lastLogin = ''

const CronJob = require("cron").CronJob;
const job = new CronJob({
  cronTime: process.env.SLEEP_TIME,
  onTick: loadPage,
});

function loadPage(){
  scrapSource()
}

function loadInitial(){
  initial();
}

async function createBrowser(cb) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--incognito"],
  });
  context = await browser.createIncognitoBrowserContext();
  cb()
}

function formatDate(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) 
      month = '0' + month;
  if (day.length < 2) 
      day = '0' + day;

  return [year, month, day].join('-');
}

function addDays(date, days){
  return new Date().setDate(date.getDate() + days)
}

function getTimestampInSec(date){
  return (new Date(date.getFullYear(),date.getMonth() ,date.getDate()).getTime())/1000;
}

function getCurrentDateTime(){
  return new Date(new Date().toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
  }))
}

//Test case
// function testDate(dateString){
//   const currentDateTime = new Date(Date.parse(dateString)); 
//   let searchDays = 14;
//   if(currentDateTime.getHours() >= 6){
//     searchDays += 1;
//   }
//   let searchDate = new Date(addDays(currentDateTime, searchDays))
//   console.log("InputDate: "+dateString+' Date to search: '+formatDate(searchDate))
// }

// testDate(1608570000000)
// testDate("22 Dec 2020 :00:00 GMT+0800")
// testDate("22 Dec 2020 :03:00 GMT+0800")
// testDate("22 Dec 2020 :07:00 GMT+0800")
// testDate("22 Dec 2020 :08:00 GMT+0800")
// testDate("22 Dec 2020 :09:00 GMT+0800")
// testDate("22 Dec 2020 :10:00 GMT+0800")
// testDate("22 Dec 2020 :15:00 GMT+0800")
// testDate("22 Dec 2020 :23:00 GMT+0800")
// testDate("23 Dec 2020 :00:00 GMT+0800")
// testDate("23 Dec 2020 :03:00 GMT+0800")
// testDate("23 Dec 2020 :05:00 GMT+0800")
// testDate("23 Dec 2020 :07:00 GMT+0800")
// testDate("23 Dec 2020 :08:00 GMT+0800")
// testDate("23 Dec 2020 :09:00 GMT+0800")

createBrowser(loadInitial);


async function scrapSource(){
    var page = await context.newPage();
  try{
    const currentDateTime = getCurrentDateTime();
    const currentTimestamp = getTimestampInSec(currentDateTime);
    let searchDays = 14;
    // Search the 15th day between after 6pm
    if(currentDateTime.getHours() >= 6){
      searchDays += 1;
    }
    let searchDate = new Date(addDays(currentDateTime, searchDays))
    
    let searchTimestamp = getTimestampInSec(searchDate)

    let currentTimeWithSec = currentDateTime.getTime()/1000
    console.log('currentTimestamp', currentTimeWithSec)
    console.log('lastLogin', lastLogin)

    if(currentTimeWithSec - lastLogin > 1400){
      try{
        await login()
      }
      catch(err){
        console.log('Something wrong with logging in', err)
      }
    }

    console.log('Start')

    // console.log(formatDate(currentDateTime))
    // console.log(currentTimestamp)
    console.log('searchDate', formatDate(searchDate))
    // console.log('searchTimeStamp',searchTimestamp)

    //Sport hall 15 days in advance 
    const VENUE_IDS = process.env.VENUE_IDS.split(", ");

    
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
    );
    await page.setCacheEnabled(false);
    await page.setJavaScriptEnabled(true);

    //   page.on('response', async(response) => {
    //     console.log(response.request)
    // })
    
    let telegramFlag = false

    let msg = ''
    msg += formatDate(searchDate) +'\n\n'

    for(let i=0;i<VENUE_IDS.length;i++){
      let venue = VENUE_IDS[i]
      let url = `https://members.myactivesg.com/facilities/view/activity/18/venue/${venue}?time_from=${searchTimestamp}`;
      // console.log('debugUrl', url)
      const response = await page.goto(url, {waitUntil: 'networkidle0'})

      var data = await response.text();
      // console.log('data', data)
      
      try{
        const document = new JSDOM(data).window.document;
        const location = document.querySelector('p.item-desc-subtitle').textContent
        console.log(location)
        
        msg += location +'\n\n';
        const courts = document.querySelectorAll('div.timeslot-container div.subvenue-slot')
        courts.forEach((court) =>{
          let courtFlag = false;
          let courtNo = court.querySelector('h4').textContent
          console.log(courtNo)
          let divList = court.querySelectorAll('div.col-xs-4.col-sm-2.chkbox-grid')
          divList.forEach(div =>{
            let input = div.querySelector('input[type="checkbox"]')
            if (!input.hasAttribute("disabled")){
              telegramFlag = true
              let label = div.querySelector('label')
              if(!courtFlag){
                msg += '---'+courtNo +'---\n';
                courtFlag = true
              }
              msg += label.textContent +'\n';
              console.log(label.textContent+" is avaliable")
            }
          })
        })
        msg += '\n'
      }
      catch(err){
        console.log(data)
        console.log(`Something went wrong with ${venue}`, err)
      }
      

    }
    await page.close();

    if(telegramFlag){
      if(previousMsg !== msg){
        previousMsg = msg
        telegram_bot_sendtext([msg])
      }
      
    }

    console.log('Close')
  }
  catch(err){
    console.log('Something went wrong with scrapping',err)
    await page.close();
  }

  

  // let result = await page.evaluate(() => {
    
  //   const contextCurrentDate = new Date(new Date().toLocaleString("en-US", {
  //     timeZone: "Asia/Shanghai",
  //   }));

  //   function formatDate(date) {
  //     var d = new Date(date),
  //         month = '' + (d.getMonth() + 1),
  //         day = '' + d.getDate(),
  //         year = d.getFullYear();
  
  //     if (month.length < 2) 
  //         month = '0' + month;
  //     if (day.length < 2) 
  //         day = '0' + day;
  
  //     return [year, month, day].join('-');
  //   }

  //   function addDays(date, days){
  //     return new Date().setDate(date.getDate() + days)
  //   }

  //   const currentTimestamp = new Date(contextCurrentDate.getFullYear(),contextCurrentDate.getMonth() ,contextCurrentDate.getDate()).getTime();
  //   let params = {
  //     activity_id: 18,
  //     venue_id: 308,
  //     date: formatDate(addDays(contextCurrentDate, 1)),
  //     time_from: currentTimestamp
  //   }
  //   // let response = CS.get("facilities/ajax/getTimeslots", params);
  //   var myHeaders = new Headers();
  //   myHeaders.append('X-Requested-With', 'XMLHttpRequest');
  //   myHeaders.append('Content-Type', 'application/json')
  //   var url = `https://members.myactivesg.com/facilities/ajax/getTimeslots?activity_id=18&venue_id=292&date=2020-12-31&time_from=1608566400`
  //   fetch(url, {
  //     method: 'GET',
  //     credentials: 'include',
  //     headers: myHeaders
  //   })
  //     .then((response) => response)
      
  //     .catch((err) => {
  //       console.log('err',err);
  //   });
      
  // });

  // console.log(result)
  
  
  

  

  // await page.close();
}

async function login(){
  console.log('Logging in')
  try{
    const USER_NAME = process.env.USER_NAME;
    const PASSWORD = process.env.PASSWORD;
    var page = await context.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
    );
    await page.setCacheEnabled(false);
    await page.setJavaScriptEnabled(true);

    await page.goto(`https://members.myactivesg.com/auth`, {waitUntil: 'networkidle0'});

    await Promise.all([
      page.waitForSelector(`input[id="email"]`),
      page.waitForSelector(`input[id="password"]`),
      page.waitForSelector(`input[name="ecpassword"]`),
      page.waitForSelector(`input[name="_csrf"]`),
      page.waitForSelector(`input[id="btn-submit-login"]`)
    ]);

    await page.type('input[id="email"]', USER_NAME);
    await page.type('input[id="password"]', PASSWORD);

    await page.click('input[id="btn-submit-login"]');

    await page.waitForNavigation({
        waitUntil: 'networkidle0',
    })

    const currentDateTime = getCurrentDateTime();

    lastLogin = currentDateTime.getTime()/1000
  }
  catch(err){
    console.log('Error with login, closing page')
    await page.close();
  }
    
}

// async function login2(){
//   var page = await context.newPage();
//     await page.setUserAgent(
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
//     );
//     await page.setCacheEnabled(false);
//     await page.setJavaScriptEnabled(true);

//     await page.goto(`https://members.myactivesg.com/auth`, {waitUntil: 'networkidle0'});

//     await Promise.all([
//       page.waitForSelector(`input[id="email"]`),
//       page.waitForSelector(`input[id="password"]`),
//       page.waitForSelector(`input[name="ecpassword"]`),
//       page.waitForSelector(`input[name="_csrf"]`),
//       page.waitForSelector(`input[id="btn-submit-login"]`)
//     ]);

//     await page.type('input[id="email"]', `cywteow@gmail.com`);
//     await page.type('input[id="password"]', `password`);

//     await page.click('input[id="btn-submit-login"]');

//     await page.waitForNavigation({
//         waitUntil: 'networkidle0',
//     })

//     const currentDateTime = new Date(new Date().toLocaleString("en-US", {
//       timeZone: "Asia/Shanghai",
//     }));

//     lastLogin = getTimestampInSec(currentDateTime)

//     await page.goto(`https://members.myactivesg.com/facilities/quick-booking`, {waitUntil: 'networkidle0'});

//     let result = await page.evaluate(() => {
//       var body = {
//         activity_filter: 18,
//         venue_filter: venue_filter,
//         date_filter: 'Thu, 31 Dec 2020'
//       }
//       var myHeaders = new Headers();
//       myHeaders.append('X-Requested-With', 'XMLHttpRequest');
//       myHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
//       myHeaders.append('Content-Length', '66');
//       var url = `https://members.myactivesg.com/facilities/quick-booking`
//       fetch(url, {
//         method: 'POST',
//         credentials: 'include',
//         headers: myHeaders,
//         body: body
//       })
//         .then((response) => response.json())
        
//         .catch((err) => {
//           console.log('err',err);
//       });
//     })
// }

async function initial(){
    await login();

    job.start();
}

//  Message to send to Telegram
function telegram_bot_sendtext(bot_message_array) {
  const axios = require("axios");

  const bot_token = process.env.BOT_TOKEN;
  const bot_chatID = process.env.BOT_CHATID.split(", ");

  bot_chatID.map(chatId =>{
    bot_message_array.forEach((bot_message) => {
      const send_text =
        "https://api.telegram.org/bot" +
        bot_token +
        "/sendMessage?chat_id=" +
        chatId +
        "&parse_mode=html&text=" +
        encodeURI(bot_message);
  
      axios
        .get(send_text)
        .then(function (response) {
          // handle success
          console.log(response.data.result.text + "\n");
        })
        .catch(function (error) {
          // handle error
          console.log(error.config.url);
        })
        .then(function () {
          // always executed
        });
    });
  })
  
}

