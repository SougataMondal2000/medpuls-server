const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const Doctor = require("./models/doctorModel");
const Patient = require("./models/patientModel");
const Prescription = require("./models/prescriptionModel");
const Misc = require("./models/miscModel");
const multer = require("multer");
const XLSX = require("xlsx");

dotenv.config();
const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;
const JWT_SECRET =
  process.env.JWT_SECRET || "23+40FldreX+xJbozW+tYN8Ku/U9v0C14Y9oUSdkw48=";

app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("App connected to database.");
    app.listen(PORT, () => {
      console.log(`App is listening to port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header is missing" });
  }

  const token = authHeader.split(" ")[1]; // Extract the token (e.g., "Bearer <token>")

  if (!token) {
    return res.status(401).json({ message: "Token is missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token", error });
  }
};

const validateData = (row) => {
  const requiredFields = ["name", "type"];
  const validTypes = ["drug", "dose", "frequency", "day", "remarks", "test"];

  for (const field of requiredFields) {
    if (!row[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!validTypes.includes(row.type)) {
    throw new Error(
      `Invalid type: ${row.type}. Must be one of: ${validTypes.join(", ")}`
    );
  }

  return true;
};

app.post("/signup", async (req, res) => {
  try {
    const { doctorName, email, phoneNo, password } = req.body;

    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ message: "Doctor already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDoctor = new Doctor({
      doctorName,
      email,
      phoneNo,
      password: hashedPassword,
    });

    await newDoctor.save();
    res.status(201).json({ message: "Doctor registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error registering doctor", error });
  }
});

app.post("/login", async (req, res) => {
  try {
    console.log("Request Body:", req.body);

    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const doctor = await Doctor.findOne({
      email: new RegExp(`^${email}$`, "i"),
    });
    if (!doctor) {
      console.log("Doctor not found for email:", email);
      return res.status(404).json({ message: "Doctor not found" });
    }

    console.log("Doctor found:", doctor);

    const isPasswordValid = await bcrypt.compare(password, doctor.password);
    if (!isPasswordValid) {
      console.log("Invalid password for email:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: doctor._id }, JWT_SECRET, { expiresIn: "1h" });
    console.log("Token generated successfully");

    const profile = {
      id: doctor._id,
      doctorName: doctor.doctorName,
      email: doctor.email,
      phoneNo: doctor.phoneNo,
    };

    res.status(200).json({ message: "Login successful", token, profile });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

app.get("/doctors", verifyJWT, async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .populate("patients")
      .populate("previousPrescriptions");
    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching doctors", error });
  }
});

app.get("/doctor/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findById(id)
      .populate("patients")
      .populate("previousPrescriptions");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor);
  } catch (error) {
    res.status(500).json({ message: "Error fetching doctor", error });
  }
});

app.put("/doctor/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { doctorName, email, phoneNo, password } = req.body;

    let updateData = { doctorName, email, phoneNo };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedDoctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res
      .status(200)
      .json({ message: "Doctor updated successfully", updatedDoctor });
  } catch (error) {
    res.status(500).json({ message: "Error updating doctor", error });
  }
});

app.put("/add-patient/:patientId/:doctorId", verifyJWT, async (req, res) => {
  const { patientId } = req.params;
  const { doctorId } = req.params;

  try {
    if (
      !mongoose.Types.ObjectId.isValid(patientId) ||
      !mongoose.Types.ObjectId.isValid(doctorId)
    ) {
      return res.status(400).json({
        message: "Invalid patientId or prescriptionId or doctorId!",
      });
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $addToSet: { patients: patientId } },
      { new: true }
    );

    if (!updatedDoctor) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.status(200).json({
      message: "Prescription added successfully",
      patient: updatedPatient,
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error("Error adding prescription:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/add-patient/:doctorId", verifyJWT, async (req, res) => {
  const { doctorId } = req.params;
  const { patientId } = req.body;

  try {
    if (
      !mongoose.Types.ObjectId.isValid(doctorId) ||
      !mongoose.Types.ObjectId.isValid(patientId)
    ) {
      return res.status(400).json({ message: "Invalid doctorId or patientId" });
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $addToSet: { patients: patientId } },
      { new: true }
    );

    if (!updatedDoctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json({
      message: "Patient added successfully",
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error("Error adding patient:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/doctor/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedDoctor = await Doctor.findByIdAndDelete(id);

    if (!deletedDoctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json({ message: "Doctor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting doctor", error });
  }
});

// app.get("/patients", verifyJWT, async (req, res) => {
//   try {
//     const { parentId } = req.query;

//     const pipeline = [];

//     if (parentId) {
//       pipeline.push({
//         $match: { parentId: mongoose.Types.ObjectId(parentId) },
//       });
//     }

//     pipeline.push({
//       $lookup: {
//         from: "prescriptions",
//         localField: "previousPrescriptions",
//         foreignField: "_id",
//         as: "previousPrescriptions",
//       },
//     });

//     const patients = await Patient.aggregate(pipeline);
//     res.status(200).json(patients);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

app.get("/patients", verifyJWT, async (req, res) => {
  try {
    const patients = await Patient.find();
    res.status(200).json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/patients/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findById(id).populate(
      "previousPrescriptions"
    );
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.status(200).json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/patients", verifyJWT, async (req, res) => {
  try {
    const {
      name,
      age,
      sex,
      phone,
      medicalHistory,
      parentId,
      mail,
      address,
      guardianName,
      height,
      weight,
      pulse,
      bp,
    } = req.body;

    const requiredFields = [
      "name",
      "age",
      "sex",
      "phone",
      "mail",
      "guardianName",
      "height",
      "weight",
      "pulse",
      "bp",
      "parentId",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const requiredAddressFields = ["addressLine1", "pincode", "city", "state"];
    const missingAddressFields = requiredAddressFields.filter(
      (field) => !address || !address[field]
    );

    if (missingAddressFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required address fields: ${missingAddressFields.join(
          ", "
        )}`,
      });
    }

    const newPatient = new Patient({
      name,
      address: {
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || "",
        pincode: address.pincode,
        city: address.city,
        state: address.state,
      },
      age,
      sex,
      phone,
      mail,
      guardianName,
      height,
      weight,
      pulse,
      bp,
      medicalHistory: medicalHistory || [],
      parentId: parentId,
    });
    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/patients/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedPatient = await Patient.findByIdAndUpdate(id, updates, {
      new: true,
    }).populate("previousPrescriptions");
    if (!updatedPatient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.status(200).json(updatedPatient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put(
  "/add-prescription/:patientId/:doctorId",
  verifyJWT,
  async (req, res) => {
    const { patientId } = req.params;
    const { doctorId } = req.params;
    const { prescriptionId } = req.body;

    try {
      if (
        !mongoose.Types.ObjectId.isValid(patientId) ||
        !mongoose.Types.ObjectId.isValid(prescriptionId) ||
        !mongoose.Types.ObjectId.isValid(doctorId)
      ) {
        return res.status(400).json({
          message: "Invalid patientId or prescriptionId or doctorId!",
        });
      }

      const updatedPatient = await Patient.findByIdAndUpdate(
        patientId,
        { $addToSet: { previousPrescriptions: prescriptionId } },
        { new: true }
      );

      if (!updatedPatient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const updatedDoctor = await Doctor.findByIdAndUpdate(
        doctorId,
        { $addToSet: { previousPrescriptions: prescriptionId } },
        { new: true }
      );

      if (!updatedDoctor) {
        return res.status(404).json({ message: "Patient not found" });
      }

      res.status(200).json({
        message: "Prescription added successfully",
        patient: updatedPatient,
        doctor: updatedDoctor,
      });
    } catch (error) {
      console.error("Error adding prescription:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

app.delete("/patients/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPatient = await Patient.findByIdAndDelete(id);
    if (!deletedPatient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.status(200).json({ message: "Patient deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-all-prescriptions/:doctorId", verifyJWT, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const matchStage = {};
    if (doctorId) {
      matchStage.doctorDetails = new mongoose.Types.ObjectId(doctorId);
    }

    const pipeline = [
      {
        $match: matchStage,
      },
      {
        $lookup: {
          from: "doctors",
          localField: "doctorDetails",
          foreignField: "_id",
          as: "doctorDetails",
        },
      },
      {
        $unwind: {
          path: "$doctorDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    const prescriptions = await Prescription.aggregate(pipeline);
    res.status(200).json(prescriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/prescriptions/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id)
      .populate("patientDetails")
      .populate("doctorDetails");
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }
    res.status(200).json(prescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/prescriptions", verifyJWT, async (req, res) => {
  try {
    const { patientDetails, doctorDetails, medicines, description, tests } =
      req.body;

    const newPrescription = new Prescription({
      patientDetails,
      doctorDetails,
      medicines,
      description,
      tests,
    });

    await newPrescription.save();

    const populatedPrescription = await Prescription.findById(
      newPrescription._id
    )
      .populate("patientDetails")
      .populate("doctorDetails");

    res.status(201).json(populatedPrescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/prescriptions/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    )
      .populate("patientDetails")
      .populate("doctorDetails");
    if (!updatedPrescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }
    res.status(200).json(updatedPrescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/prescriptions/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPrescription = await Prescription.findByIdAndDelete(id);
    if (!deletedPrescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }
    res.status(200).json({ message: "Prescription deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/misc", verifyJWT, async (req, res) => {
  try {
    const { type } = req.query;
    const pipeline = [];

    if (type) {
      pipeline.push({ $match: { type } });
    }

    const tests = await Misc.aggregate(pipeline);
    res.status(200).json(tests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/misc/:id", verifyJWT, async (req, res) => {
  try {
    const test = await Misc.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Misc not found" });
    res.status(200).json(test);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/misc-combined-data", async (req, res) => {
  try {
    const miscItems = await Misc.find({}, "name type");
    const miscData = miscItems.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item.name);
      return acc;
    }, {});

    res.json({ miscData });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/misc", verifyJWT, async (req, res) => {
  try {
    const { name, type } = req.body;
    const test = new Misc({ name, type });
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/bulk-add-misc", verifyJWT, async (req, res) => {
  try {
    const data = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({
        message: "Invalid data format. Expected an array of objects.",
      });
    }

    const tests = await Misc.insertMany(data, { ordered: true });
    res.status(201).json(tests);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post(
  "/bulk-add-misc-excel",
  verifyJWT,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      if (!data.length) {
        return res.status(400).json({ error: "Excel file is empty" });
      }

      const validatedData = [];
      const errors = [];

      data.forEach((row, index) => {
        try {
          if (validateData(row)) {
            validatedData.push(row);
          }
        } catch (error) {
          errors.push(`Row ${index + 1}: ${error.message}`);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({
          error: "Validation errors found",
          details: errors,
        });
      }

      const result = await Misc.insertMany(validatedData);

      res.status(200).json({
        message: "Bulk upload successful",
        recordsInserted: result.length,
      });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({
        error: "Failed to process bulk upload",
        details: error.message,
      });
    }
  }
);

app.put("/misc/:id", verifyJWT, async (req, res) => {
  try {
    const { name, type } = req.body;
    const test = await Misc.findByIdAndUpdate(
      req.params.id,
      { name, type },
      { new: true, runValidators: true }
    );

    if (!test) return res.status(404).json({ message: "Misc not found" });
    res.status(200).json(test);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/misc/:id", verifyJWT, async (req, res) => {
  try {
    const test = await Misc.findByIdAndDelete(req.params.id);
    if (!test) return res.status(404).json({ message: "Misc not found" });
    res.status(200).json({ message: "Misc deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
