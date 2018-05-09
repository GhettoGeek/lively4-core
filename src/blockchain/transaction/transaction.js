import forge from 'node_modules/node-forge/dist/forge.min.js';

export default class Transaction {
  constructor(senderWallet, inputCollection, outputCollection) {
    this.timestamp = Date.now();
    this.senderHash = senderWallet.hash;
    this.senderPublicKey = senderWallet.publicKey;
    this.inputs = inputCollection;
    this.outputs = outputCollection;    
    this.hash = this._hash();
    this.signature = this._generateSignature(senderWallet);
  }
  
  isSigned() {
    return !!this.signature;
  }
  
  isVerified() {
    if (!this.isSigned()) {
      return false;
    }
    
    // recalculate hash for comparison
    // if anything was changed, this hash will not match the encrypted hash (signature)
    var hash = this._hash();
    
    // decrypt the signature using the public key (==> hash) and compare with the hash we just calculated
    return this.senderPublicKey.verify(hash.digest().bytes(), this.signature);
  }
  
  inputValue() {
    return this.inputs.value();
  }
  
  outputValue() {
    return this.outputs.value();
  }
  
  fees() {
    return this.inputValue() - this.outputValue();
  }
  
  _generateSignature(senderWallet) {
    if (this.isSigned()) {
      return this;
    }
    
    if (this.fees() < 0) {
      throw new Error("Fee must be positive");
    }
    
    // encrypt the hash using the given private key
    // this allows us to decrypt the signature later
    // on using the matching public key
    return senderWallet.sign(this.hash);
  }
  
  _hash() {
    var sha256 = forge.md.sha256.create();
    return sha256.update(
      this.timestamp + 
      this.senderHash + 
      this.senderPublicKey + 
      this.inputs.hash + 
      this.outputs.hash
    );
  }
}