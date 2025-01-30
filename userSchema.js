const mongoose = require("mongoose");

// Define the user schema
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // Ensures no two users have the same email
      lowercase: true, // Converts email to lowercase before saving
    },
    password: {
      type: String,
      required: true, // Password field
    },
    firstName: {
      type: String,
      required: true, // First name for signup
    },
    lastName: {
      type: String,
      required: true, // Last name for signup
    },
    phone: {
      type: Number,
      default: null, // Default to null if not set
    },
    profileImageUrl: {
      type: String,
      default: null, // Default to null if not set
    },
    institutionType: {
      type: String,
      default: null, // Default to null if not set
    },
    class: {
      type: String,
      default: null, // Default to null if not set
    },
    institutionName: {
      type: String,
      default: null, // Default to null if not set
    },
    degreeName: {
      type: String,
      default: null, // Default to null if not set
    },
    passingYear: {
      type: String,
      default: null, // Default to null if not set
    },

    completedTests: {
      type: [String], // Array of test names
      default: [], // Default to an empty array
    },
    submittedTest: [{
      examId: { type: String, required: true },
      answers: { type: Map, of: String },
      date: { type: Date, default: Date.now }
    }]
    
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

// Create the user model based on the schema
const User = mongoose.model("User", userSchema);

module.exports = User;
