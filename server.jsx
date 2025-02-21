const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Exam = require("./examSchema"); // Import the Exam model
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./userSchema");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");

const upload = multer({ dest: "uploads/avatars/" }); // Destination folder for avatars

const app = express();
// Increase the limit to 10MB (or any suitable value)
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
const port = 5000;

app.use(express.json());
app.use(
  cors({
    origin: "*", // Replace with your frontend URL
    methods: "GET, POST, PUT, DELETE",
    allowedHeaders: "Content-Type, Authorization",
  })
);

const JWT_SECRET = "your_jwt_secret_key"; // Store this in an env variable for security

// MongoDB Connection
mongoose
  .connect(
    "mongodb+srv://contentsimplified4u:content%40123@cluster0.aad41.mongodb.net/hierarchy"
  )
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error: ", err));

// Middleware to verify JWT token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Get token from Authorization header
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Verify the token
    req.user = decoded; // Store user information in the request object
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

// Entity Schema
const entitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Entity",
    default: null,
  }, // Use parentId instead of parentName
  description: { type: String, default: "" }, // Add description field
  testName: { type: String, default: "" }, // Add testName field
  videoLink: { type: String, default: "" }, // Add videoLink field
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Entity" }], // Reference to child entities
  position: { type: Number, default: 0 }, // Add position field
});
const Entity = mongoose.model("Entity", entitySchema);

app.post("/api/entities", async (req, res) => {
  try {
    const { name, type, parentId, description, testName, videoLink } = req.body;

    let newEntity = new Entity({
      name,
      type,
      parentId,
      description,
      testName,
      videoLink,
      children: [], // No children initially/
    });

    // Save the new entity
    await newEntity.save();

    if (parentId) {
      // Find parent entity by name
      const parentEntity = await Entity.findById(parentId);

      if (!parentEntity) {
        return res.status(400).json({ message: "Parent entity not found" });
      }

      // Add the new entity's ID to the parent's children array
      parentEntity.children.push(newEntity._id);
      await parentEntity.save();
    }
    const savedEntity = await Entity.findById(newEntity._id);
    res.status(201).json(newEntity);
  } catch (error) {
    console.error("Error adding entity:", error);
    res
      .status(500)
      .json({ message: "Error adding entity", error: error.message });
  }
});

// Modify GET /api/entities endpoint
app.get("/api/entities", async (req, res) => {
  try {
    const populateTree = async (parentId = null) => {
      return Entity.find({ parentId })
        .sort("position")
        .populate({
          path: "children",
          populate: {
            path: "children",
            populate: {
              path: "children",
              populate: {
                // Add one more level for paper
                path: "children",
              },
            },
          },
        })
        .exec();
    };

    const entities = await populateTree();
    res.json(entities);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
app.post("/api/entities/reorder", async (req, res) => {
  try {
    const { updatedData } = req.body;

    const updateParentChildren = async (entities, parentId = null) => {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        await Entity.findByIdAndUpdate(entity._id, {
          parentId,
          position: parentId === null ? i : 0,
        });

        if (entity.children) {
          await updateParentChildren(entity.children, entity._id);
        }
      }

      if (parentId !== null) {
        const parent = await Entity.findById(parentId);
        if (parent) {
          parent.children = entities.map((e) => e._id);
          await parent.save();
        }
      } else {
        for (let i = 0; i < entities.length; i++) {
          await Entity.findByIdAndUpdate(entities[i]._id, { position: i });
        }
      }
    };

    await updateParentChildren(updatedData);
    res.json({ message: "Entities reordered successfully" });
  } catch (err) {
    console.error("Error reordering entities:", err);
    res
      .status(500)
      .json({ message: "Error reordering entities", error: err.message });
  }
});
// Update the entire hierarchy
app.post("/api/entities/update", async (req, res) => {
  try {
    const updatedEntities = req.body; // The entire updated hierarchy is sent in the request body

    // Process the entities and update them in the database
    for (const entityData of updatedEntities) {
      // If entity exists, update it
      const entity = await Entity.findOne({ name: entityData.name });

      if (entity) {
        // Update the entity
        entity.type = entityData.type;
        entity.description = entityData.description || ""; // Update description if provided
        entity.children = entityData.children || []; // Update the children array

        // Save the entity
        await entity.save();
      } else {
        // If the entity doesn't exist, create it
        const newEntity = new Entity({
          name: entityData.name,
          type: entityData.type,
          parentId: entityData.parentId || null,
          description: entityData.description || "", // Add description field
          children: entityData.children || [],
        });

        await newEntity.save();
      }
    }

    res.json({ message: "Hierarchy updated successfully" });
  } catch (err) {
    console.error("Error updating hierarchy:", err);
    res.status(500).json({ message: "Error updating hierarchy", error: err });
  }
});

// Update an entity (optional, for individual updates)
app.put("/api/entities/:id", async (req, res) => {
  try {
    const updatedEntity = await Entity.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.json(updatedEntity);
  } catch (err) {
    console.error("Error updating entity:", err);
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/entities/:id", async (req, res) => {
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity) return res.status(404).json({ message: "Entity not found" });

    // Remove the entity from its parent's children list
    const parent = await Entity.findOne({ children: req.params.id });
    if (parent) {
      parent.children.pull(req.params.id);
      await parent.save();
    }

    // Recursively delete all children
    const deleteChildren = async (entityId) => {
      const children = await Entity.find({ parentId: entityId });
      for (const child of children) {
        await deleteChildren(child._id);
        await Entity.findByIdAndDelete(child._id);
      }
    };
    await deleteChildren(entity._id);

    // Remove the entity itself
    await Entity.findByIdAndDelete(req.params.id);
    res.json({ message: "Entity deleted" });
  } catch (err) {
    console.error("Error deleting entity:", err);
    res
      .status(500)
      .json({ message: "Error deleting entity", error: err.message });
  }
});

app.post("/api/exam", async (req, res) => {
  const { sheetData, examId, examName } = req.body;
  if (!sheetData || sheetData.length === 0) {
    return res.status(400).json({ message: "No data provided" });
  }

  try {
    const exam = new Exam({
      examId: examId, // Add examId
      examName: examName,
      questions: sheetData.map((question) => ({
        questionNo: question["Question No."],
        questionText: question["Question"],
        questionImage: question["Question Image"] || "", // Handle optional field
        optionA: question["Option A"],
        optionAImage: question["Option A Image"] || "", // Handle optional field
        optionB: question["Option B"],
        optionBImage: question["Option B Image"] || "", // Handle optional field
        optionC: question["Option C"] || "", // Optional field
        optionCImage: question["Option C Image"] || "", // Optional field
        optionD: question["Option D"] || "", // Optional field
        optionDImage: question["Option D Image"] || "", // Optional field
        correctAnswer: question["Correct Answer"] || "", // Optional: Define how to store the correct answer
        explanation: question["Explanation"] || "", // Add explanation field
        explanationImage: question["Explanation Image"] || "", // Add explanation image field (optional)
      })),
    });

    await exam.save();
    res.status(200).json({ message: "Exam data saved successfully", exam });
  } catch (error) {
    console.error("Error saving exam data:", error);
    res
      .status(500)
      .json({ message: "Error saving exam data", error: error.message });
  }
});

app.get("/api/exams", async (req, res) => {
  try {
    // Fetch all exams from the Exam collection
    const exams = await Exam.find(); // You can add any filters if needed (e.g., by examId, examName, etc.)

    // If no exams are found
    if (exams.length === 0) {
      return res.status(404).json({ message: "No exams found" });
    }

    // Respond with the exams data
    res.status(200).json(exams);
  } catch (err) {
    console.error("Error fetching exams:", err);
    res
      .status(500)
      .json({ message: "Error fetching exams", error: err.message });
  }
});

// Update exam name by ID
app.put("/api/exams/:id", async (req, res) => {
  const { id } = req.params; // Get the ID from the URL
  const { examName } = req.body; // Get the new name from the request body

  if (!examName || !examName.trim()) {
    return res
      .status(400)
      .json({ message: "Exam name is required and cannot be empty." });
  }

  try {
    // Find the exam by ID and update the name
    const updatedExam = await Exam.findByIdAndUpdate(
      id,
      { examName },
      { new: true, runValidators: true } // Return the updated document and validate
    );

    if (!updatedExam) {
      return res.status(404).json({ message: "Exam not found." });
    }

    res
      .status(200)
      .json({ message: "Exam updated successfully.", exam: updatedExam });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

// Delete exam by ID
app.delete("/api/exams/:id", async (req, res) => {
  const { id } = req.params; // Get the ID from the URL

  try {
    // Find the exam by ID and delete it
    const deletedExam = await Exam.findByIdAndDelete(id);

    if (!deletedExam) {
      return res.status(404).json({ message: "Exam not found." });
    }

    res
      .status(200)
      .json({ message: "Exam deleted successfully.", exam: deletedExam });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

// API to get an exam based on the examId
app.get("/api/exams/:id", async (req, res) => {
  try {
    const exam = await Exam.findOne({ examId: req.params.id });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    res.json(exam);
  } catch (err) {
    console.error("Error fetching exam:", err);
    res
      .status(500)
      .json({ message: "Error fetching exam", error: err.message });
  }
});

app.post("/signup", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already in use" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    // Generate a JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email }, // Payload (user's info)
      JWT_SECRET, // Secret key to sign the JWT
      { expiresIn: "1h" } // Expiry time for the token (1 hr)
    );

    // Respond with success and the JWT token
    res.status(201).json({
      success: true,
      user: savedUser,
      token, // Send the JWT token in the response
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error creating user" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Check if the password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Respond with success and the JWT token
    res.status(200).json({
      success: true,
      user,
      token, // Send the JWT token in the response
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login error" });
  }
});

// Example of a protected route
app.get("/protected", authenticate, (req, res) => {
  res
    .status(200)
    .json({
      success: true,
      message: "Protected route accessed",
      user: req.user,
    });
});

app.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    // Fetch user data from MongoDB
    const user = await User.findById(userId).select("-password"); // Exclude the password field
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user from DB:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/users/update-avatar", authenticate, async (req, res) => {
  const { profileImageUrl } = req.body; // New image URL passed in the request body
  const userId = req.user.userId; // Extract user ID from the JWT

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImageUrl },
      { new: true } // Return the updated user document
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error updating avatar:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Endpoint to mark a test as completed
app.post("/api/tests/markCompleted", authenticate, async (req, res) => {
  const { email, testName, submittedTest } = req.body;
  if (!email || !testName || !submittedTest) {
    return res
      .status(400)
      .json({ message: "Email and testName are required." });
  }

  try {
    // Find the user and update their completedTests array
    const user = await User.findOneAndUpdate(
      { email },
      {
        $push: {
          completedTests: testName, // Add the test name to the completedTests array
        },
        $addToSet: {
          submittedTest: {
            examId: submittedTest.examId,
            answers: submittedTest.answers,
            date: new Date(), // Save current timestamp
          },
        },
      },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      message: "Test marked as completed successfully.",
      completedTests: user.completedTests,
    });
  } catch (error) {
    console.error("Error updating completed tests:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Endpoint to fetch completed tests
app.get("/api/tests/getCompletedTests", authenticate, async (req, res) => {
  const { email } = req.user; // Extract email from the token payload

  try {
    // Find the user in the database
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Return the completed tests
    res.status(200).json({
      message: "Completed tests retrieved successfully.",
      completedTests: user.completedTests,
    });
  } catch (error) {
    console.error("Error fetching completed tests:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Endpoint to upload avatar
app.put("/users/update-avatar", upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.body.userId; // User ID from request body or JWT token
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Save the file path to the database (assuming you have a User model)
    const avatarUrl = path.join("uploads/avatars", file.filename);
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImageUrl: avatarUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Avatar updated successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.get("/users/:userId/avatar", async (req, res) => {
  const userId = req.params.userId;
  const user = await User.findById(userId);

  if (!user || !user.profileImageUrl) {
    return res.status(404).json({ error: "Avatar not found" });
  }

  const avatarPath = path.join(__dirname, "avatars", user.profileImageUrl);
  res.sendFile(avatarPath);
});

app.get("/users", authenticate, async (req, res) => {
  const { email, examId } = req.query; // Get email and examId from query parameters

  if (!email || !examId) {
    return res.status(400).json({ message: "Missing email or examId" });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Assuming the user object has an array of 'completedTests' or 'submittedTest'
    // Search for the exam object in 'completedTests' array by examId
    const userExam =
      user.completedTests.find((test) => test.examId === examId) ||
      user.submittedTest.find((test) => test.examId === examId);

    if (!userExam) {
      return res.status(404).json({ message: "Exam not found for this user" });
    }

    // Return the specific exam data (test object)
    res.json(userExam);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/users/update", authenticate, async (req, res) => {
  const { userId } = req.body; // Getting userId from the JWT
  const {
    firstName,
    lastName,
    email,
    phone,
    institutionName,
    institutionType,
    class: userClass,
    degreeName,
    passingYear,
    universityName,
  } = req.body;
  try {
    // Finding user by userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Updating user data only if provided
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.institutionName = institutionName || user.institutionName;
    user.institutionType = institutionType || user.institutionType;
    user.class = userClass || user.class;
    user.degreeName = degreeName || user.degreeName;
    user.passingYear = passingYear || user.passingYear;
    user.universityName = universityName || user.universityName;

    // Save updated user
    await user.save();

    return res
      .status(200)
      .json({ message: "User information updated successfully", data: user });
  } catch (error) {
    console.error("Error updating user info:", error);
    return res
      .status(500)
      .json({ message: "Failed to update user information" });
  }
});

app.put("/users/add-info", authenticate, async (req, res) => {
  const { institutionType, class: userClass, institutionName, degreeName, passingYear } = req.body;
  const userId = req.user.userId; // Extract user ID from the JWT

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user information
    user.institutionType = institutionType || user.institutionType;
    user.class = userClass || user.class;
    user.institutionName = institutionName || user.institutionName;
    user.degreeName = degreeName || user.degreeName;
    user.passingYear = passingYear || user.passingYear;

    await user.save();

    res.status(200).json({ message: "Additional information updated successfully", user });
  } catch (error) {
    console.error("Error updating additional information:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete user route
app.delete("/users-data/:id", async (req, res) => {
  const userId = req.params.id; // Capture the user ID from the URL parameter

  try {
    const deletedUser = await User.findByIdAndDelete(userId); // Find and delete user by ID
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /users Route
app.get("/users-data", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error });
  }
});

// Define AdminCode Schema
const AdminCodeSchema = new mongoose.Schema({
  adminCode: { type: String, required: true },
});

const AdminCode = mongoose.model("AdminCode", AdminCodeSchema);

// Get Admin Code
app.get("/api/adminCode", async (req, res) => {
  try {
    const adminCode = await AdminCode.findOne();
    res.json({ adminCode: adminCode ? adminCode.adminCode : null });
  } catch (error) {
    console.error("Error fetching admin code:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create Admin Code
app.post("/api/adminCode", async (req, res) => {
  try {
    const { adminCode } = req.body;
    if (!adminCode || adminCode.length < 4) {
      return res
        .status(400)
        .json({ message: "Admin code must be at least 4 characters" });
    }

    // Delete existing code before creating a new one
    await AdminCode.deleteMany();

    const newAdminCode = new AdminCode({ adminCode });
    await newAdminCode.save();
    res.status(201).json({ message: "Admin code created successfully" });
  } catch (error) {
    console.error("Error creating admin code:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update Admin Code
app.put("/api/adminCode", async (req, res) => {
  try {
    const { adminCode } = req.body;
    if (!adminCode || adminCode.length < 4) {
      return res
        .status(400)
        .json({ message: "Admin code must be at least 4 characters" });
    }

    const updatedAdminCode = await AdminCode.findOneAndUpdate(
      {},
      { adminCode },
      { new: true }
    );
    res.json({ message: "Admin code updated successfully", updatedAdminCode });
  } catch (error) {
    console.error("Error updating admin code:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Admin Code
app.delete("/api/adminCode", async (req, res) => {
  try {
    await AdminCode.deleteMany();
    res.json({ message: "Admin code deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin code:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
