'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const passportLocalMongoose = require("passport-local-mongoose");

const UserSchema = Schema( {
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  // password: {
  //   type: String,
  //   required: true,
  //   trim: true,
  // },
  pairId: {
    type: ObjectId,
    ref: 'User',
  },
  todoTypes: {
    type: [String],
    default: [],
    trim: true,
    required: true
  },
  lastLogin: {
    type: Date,
    default: Date.now(),
  },
  google: {
    id: String,
  }
} );

UserSchema.plugin(passportLocalMongoose, { usernameField: "email" });

UserSchema.methods.isExternalAccount = function() {
  return Boolean(this.google);
}

UserSchema.methods.getExternalProviderName = function() {
  if (this.google){
    return "Google";
  } else {
    return "External"; // should never happen
  }
}

module.exports = mongoose.model( 'User', UserSchema );
