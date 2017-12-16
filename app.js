'use strict'

const { Writable } = require('stream')
const fs = require('fs')
const crypto = require('crypto')
const totp = require('otplib/totp')
totp.options = { crypto }
const readline = require('readline')

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
  let isMuted = false
  const muteStdin = new Writable({
    write: (chunk, encoding, callback) => {
      if (!isMuted)
        process.stdout.write(chunk, encoding)
      callback()
    }
  })
  const rl = readline.createInterface({
    input: process.stdin,
    output: muteStdin,
    terminal: true
  })
  rl.question('password: ', (password) => {
    rl.close()
    callback(password)
  })
  isMuted = true
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
    const salt = crypto.randomBytes(256).toString('base64')
    const salt2 = crypto.randomBytes(256).toString('base64')
    const key = crypto.pbkdf2Sync(pass, salt, 1000000, 32, 'sha512')
    const iv = crypto.pbkdf2Sync(pass, salt2, 100000, 16, 'sha512')
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
    let enc = cipher.update(`${generatingKey} ${label}`, 'utf8', 'hex')
    enc += cipher.final('hex')
    const contentToWrite = `${salt}\n${salt2}\n${enc}`
    fs.writeFileSync(getNextFileName(), contentToWrite, 'utf8')
  })
}

function showKeys() {
  const files = fs.readdirSync('keys')
    .map((file) => {
      const fileContent = fs.readFileSync('keys/' + file, 'utf8')
      const salt = fileContent.split('\n')[0]
      const salt2 = fileContent.split('\n')[1]
      return [ file, {
        salt: salt,
        salt2: salt2,
        content: fileContent.substring(salt.length + salt2.length + ('\n'.length * 2))
      }];
    })
  getPassword(pass => {
    for (const file of files) {
      const filename = file[0]
      const content = file[1].content
      const key = crypto.pbkdf2Sync(pass, file[1].salt, 1000000, 32, 'sha512')
      const iv = crypto.pbkdf2Sync(pass, file[1].salt2, 100000, 16, 'sha512')
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