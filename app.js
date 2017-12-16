'use strict'

const fs = require('fs')
const crypto = require('crypto')
const totp = require('otplib/totp')
totp.options = { crypto }
const readline = require('readline')

const salt = 'geras48t'
const salt2 = 'blkjsd8654t'

function processArgs(){
  const arg = []
  for (let i = 2; i < process.argv.length; i++){
    arg.push(process.argv[i])
  }
  if (arg.length === 0) {
    showKeys()
  } else if (arg[0] === 'addKey') {
    if (!arg[1] || !arg[2]) {
      showHelp()
      return
    }
    addKey(arg[1], arg[2])
  } else {
    showHelp()
  }
}

function showHelp(){
  console.log("normal use :");
  console.log("node app.js");
  console.log("it will display each generated pin with its label and the name of file storing your key");
  console.log("example : 666666 google 15431.key");
  console.log("");
  console.log("adding a key");
  console.log("node app.js addKey szsdfo5157zefd1f5sd4857fgsdf84s4 google");
  console.log("it will create a key file with the encrypted label as name and with the encrypter key in it.");
  console.log("Each encrypted with the password you will enter");
}

function getPassword(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question('password: ', (password) => {
    rl.close()
    callback(password)
  })
}

function getNextFileName() {
  function nextRand () { return Math.ceil(Math.random() * 200000) }
  let rand = nextRand()
  while (fs.existsSync(`keys/${rand}.key`)) {
    rand = nextRand()
  }
  return `keys/${rand}.key`
}

function addKey(generatingKey, label) {
  getPassword(pass => {
    const key = crypto.pbkdf2Sync(pass, salt, 1000000, 32, 'sha512')
    const iv = crypto.pbkdf2Sync(pass, salt2, 100000, 16, 'sha512')
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
    let enc = cipher.update(`${generatingKey} ${label}`, 'utf8', 'hex')
    enc += cipher.final('hex')
    fs.writeFileSync(getNextFileName(), enc, 'utf8')
  })
}

function showKeys() {
  const files = fs.readdirSync('keys')
    .map((file) => {
      return [ file, fs.readFileSync('keys/' + file, 'utf8') ];
    })
  getPassword(pass => {
    for (const fileContent of files) {
      const filename = fileContent[0]
      const content = fileContent[1]
      const key = crypto.pbkdf2Sync(pass, salt, 1000000, 32, 'sha512')
      const iv = crypto.pbkdf2Sync(pass, salt2, 100000, 16, 'sha512')
      const cipher = crypto.createDecipheriv('aes-256-ctr', key, iv)
      let unenc = cipher.update(content, 'hex', 'utf8')
      unenc += cipher.final('utf8')
      const [ fromKey, label ] = unenc.split(' ')
      const pin = totp.generate(fromKey)
      console.log(`${filename} ${label} ${pin}`)
    }
  })
}

processArgs()