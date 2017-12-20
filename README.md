# Console-2FA-Encrypted-Wallet

This is a program to handle a catalog of totp generating keys (like the Google Authenticator app, or FreeOTP for example),
encrypting them with a password provided by the user

## Usage 

### Adding a totp generating key to the catalog:

```bash
$> node app.js addKey
generatingKey: szsdfo5157zefd1f5sd4857fgsdf84s4 # you type the totp generating key here
label: google # then type the label to associate with this key
password: # and finaly the password to encrypt with
```

### Display the pin for every keys added

```bash
$> node app.js
password: # password again to decrypt the keys
```

Result:

```bash
15431.key google 666666
261214.key outlook 151321
etc..
```

### change the password for every keys already added

```bash
$> node app.js changePassword
old password: # old password to decrypt the keys
new password: # new password to encrypt the keys
```

It will create a copy of all the already present keys, but encrypted with the new password.
If anything goes wrong, no worry, the old keys are not deleted.

If you have choosen to have a different password for some keys, the app will simply skip the keys not matching the password 
(probably, the reason: the decrypted content of the key file will surely be a bunch of random letter from the `utf8` 
character set, but the otp standard specify the generating keys must be on the `base32` character set, and so the 
decode from `utf8` to `base32` will throw an exception, catched by the app)

## Inner Working security wise

You might want to see the code itself for the cipher part: [app.js#L102](https://github.com/antonin-lebrard/Console-2FA-Encrypted-Wallet/blob/master/app.js#L102)<br>
Each key file will be generated like this:
- A password will be asked in the stdin input
- 2 salt will be generated via the `crypto.randomBytes(256)` method, then put in a string in the `base64` character set
- the first salt will be used for the `crypto.pbkdf2Sync()` method with the password inputed, to generate the `key` for the AES algorithm
- the second salt will be used for the `crypto.pbkdf2Sync()` method with the password inputed to generate the `iv` initialisation vector for the AES algorithm
- An instance of the actual AES-256-ctr algorithm will be initialised with the `key` and the `iv`
- the `generatingKey` and the `label` will be joined by a space character then encrypted with the instance of AES
- Then the 2 salt will be written as the first two lines of the `.key` file, and the encrypted `generatingKey` and `label` as the third line

#### Note

This is a port to nodejs of the no longer working Dart version here: https://github.com/antonin-lebrard/twoAuthConsole,
but it is considerably better in security just by actually generating a random IV and salt at each encryption.
