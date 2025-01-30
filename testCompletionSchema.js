const mongoose = require("mongoose");

const testCompletionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  examId: { type: String, required: true },
  testName: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date }
});

const TestCompletion = mongoose.model("TestCompletion", testCompletionSchema);

module.exports = TestCompletion;
