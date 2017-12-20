'use strict'

const { Writable } = require('stream')
const fs = require('fs')
const crypto = require('crypto')
const otp = require('otp')
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
  } else if (arg[0] === 'changePassword') {
    changePassword()
  } else {
    showHelp()
  }
}

function showHelp(){
  console.log(' normal usage:');
  console.log('   node app.js');
  console.log(' it will display each generated pin with its label and the name of file storing your key');
  console.log(' example : 666666 google 15431.key');
  console.log('');
  console.log(' adding a key:');
  console.log('   node app.js addKey szsdfo5157zefd1f5sd4857fgsdf84s4 google');
  console.log(' it will create an encrypted .key file inside "./keys/" with a random name');
  console.log(' The encryption is based on the password you will enter');
  console.log('')
  console.log(' changing the password for every files:')
  console.log('   node app.js changePassword')
  console.log(' It will ask for your old password, and a new password to decrypt then re-encrypt every files with your new password\n')
  console.log(' As you can not actually trust any code that try to be secured')
  console.log(' You can go see the code here: https://github.com/antonin-lebrard/twoAuthConsoleNode')
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

/**
 * @param {String} pass
 * @param {String} generatingKey
 * @param {String} label
 */
function cipherIntoFile(pass, generatingKey, label) {
  try {
    otp.parse(generatingKey).totp()
  } catch (error) {
    if (error.message !== 'Invalid input - it is not base32 encoded string')
      throw error
    else
      console.log(`does not support this generating key, you certainly have done a mistake writing it`)
    return null
  }
  const salt = crypto.randomBytes(256).toString('base64')
  const salt2 = crypto.randomBytes(256).toString('base64')
  const key = crypto.pbkdf2Sync(pass, salt, 1000000, 32, 'sha512')
  const iv = crypto.pbkdf2Sync(pass, salt2, 100000, 16, 'sha512')
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  let enc = cipher.update(`${generatingKey} ${label}`, 'utf8', 'hex')
  enc += cipher.final('hex')
  const contentToWrite = `${salt}\n${salt2}\n${enc}`
  const filename = getNextFileName()
  fs.writeFileSync(filename, contentToWrite, 'utf8')
  return filename
}

/**
 * @param {String} generatingKey
 * @param {String} label
 */
function addKey(generatingKey, label) {
  getPassword(pass => {
    cipherIntoFile(pass, generatingKey, label)
  })
}

/**
 * @typedef {Object} EncFileContent
 * @property {String} filename
 * @property {String} salt
 * @property {String} salt2
 * @property {String} content
 */

/**
 * @typedef {Function} onFileDeciphered
 * @param {String} filename
 * @param {String} unencryptedContent
 */

/**
 * @param {String} pass
 * @param {Array.<EncFileContent>} filesContent
 * @param {onFileDeciphered} onKeyDecipheredFn
 */
function decipherKeys(pass, filesContent, onKeyDecipheredFn) {
  for (const file of filesContent) {
    const filename = file.filename
    const content = file.content
    const key = crypto.pbkdf2Sync(pass, file.salt, 1000000, 32, 'sha512')
    const iv = crypto.pbkdf2Sync(pass, file.salt2, 100000, 16, 'sha512')
    const cipher = crypto.createDecipheriv('aes-256-ctr', key, iv)
    let unenc = cipher.update(content, 'hex', 'utf8')
    unenc += cipher.final('utf8')
    onKeyDecipheredFn(filename, unenc)
  }
}

function getFiles() {
  return fs.readdirSync('keys')
    .map((file) => {
      const fileContent = fs.readFileSync('keys/' + file, 'utf8')
      const salt = fileContent.split('\n')[0]
      const salt2 = fileContent.split('\n')[1]
      return {
        filename: file,
        salt: salt,
        salt2: salt2,
        content: fileContent.substring(salt.length + salt2.length + ('\n'.length * 2))
      }
    })
}

/**
 * @typedef {Object} otpObj
 * @property {String} fromKey
 * @property {String} label
 */

/**
 * @param {String} from
 * @returns {otpObj}
 */
function getOtpObj (from) {
  return {
    fromKey: from.split(' ')[0],
    label: from.substring(from.indexOf(' ') + 1)
  }
}

function showKeys() {
  const filesContent = getFiles()
  getPassword(pass => {
    console.log('')
    decipherKeys(pass, filesContent, (filename, unenc) => {
      const { fromKey, label } = getOtpObj(unenc)
      try {
        const pin = otp.parse(fromKey).totp()
        console.log(`${filename} ${label} ${pin}`)
      } catch (error) {
        if (error.message !== 'Invalid input - it is not base32 encoded string')
          throw error
        else {
          let tmp = label
          if (label.length > 7) tmp = label.substring(0, 5) + '..'
          console.log(`${filename} ${tmp} certainly wrong password, cannot display pin`)
        }
      }
    })
  })
}

function changePassword() {
  console.log('asking for your current password')
  getPassword(oldPass => {
    console.log('\nnow your new password')
    getPassword(newPass => {
      const filesContent = getFiles()
      console.log('might take a while to decipher, and re-cipher')
      decipherKeys(oldPass, filesContent, (filename, unenc) => {
        const { fromKey: generatingKey, label } = getOtpObj(unenc)
        cipherIntoFile(newPass, generatingKey, label)
      })
      console.log('\nNow every key has been recreated wth your new password')
      console.log('The old ones have not been deleted')
      console.log('so that if anything wrong has happened you can retry the operation')
      console.log('without having lost every key')
    })
  })
}

processArgs()
