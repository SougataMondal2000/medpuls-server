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

dotenv.config();
const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;
const JWT_SECRET =
  process.env.JWT_SECRET || "23+40FldreX+xJbozW+tYN8Ku/U9v0C14Y9oUSdkw48=";

app.use(bodyParser.json());

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

app.get("/doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find().populate("patients");
    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching doctors", error });
  }
});

app.get("/doctor/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findById(id).populate("patients");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor);
  } catch (error) {
    res.status(500).json({ message: "Error fetching doctor", error });
  }
});

app.put("/doctor/:id", async (req, res) => {
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

app.put("/add-patient/:doctorId", async (req, res) => {
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

app.delete("/doctor/:id", async (req, res) => {
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

app.get("/patients", async (req, res) => {
  try {
    const { parentId } = req.query;

    const pipeline = [];

    if (parentId) {
      pipeline.push({
        $match: { parentId: mongoose.Types.ObjectId(parentId) },
      });
    }

    pipeline.push({
      $lookup: {
        from: "prescriptions",
        localField: "previousPrescriptions",
        foreignField: "_id",
        as: "previousPrescriptions",
      },
    });

    const patients = await Patient.aggregate(pipeline);
    res.status(200).json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/patients/:id", async (req, res) => {
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

app.post("/patients", async (req, res) => {
  try {
    const {
      name,
      age,
      sex,
      phone,
      medicalHistory,
      parentId,
      previousPrescriptions,
    } = req.body;
    const newPatient = new Patient({
      name,
      age,
      sex,
      phone,
      medicalHistory,
      parentId,
      previousPrescriptions,
    });
    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/patients/:id", async (req, res) => {
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

app.put("/add-prescription/:patientId", async (req, res) => {
  const { patientId } = req.params;
  const { prescriptionId } = req.body;

  try {
    if (
      !mongoose.Types.ObjectId.isValid(patientId) ||
      !mongoose.Types.ObjectId.isValid(prescriptionId)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid patientId or prescriptionId" });
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      { $addToSet: { previousPrescriptions: prescriptionId } },
      { new: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.status(200).json({
      message: "Prescription added successfully",
      patient: updatedPatient,
    });
  } catch (error) {
    console.error("Error adding prescription:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/patients/:id", async (req, res) => {
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

app.get("/prescriptions", async (req, res) => {
  try {
    const { doctorId, patientId } = req.query;
    const matchStage = {};
    if (doctorId) {
      matchStage.doctorDetails = new mongoose.Types.ObjectId(doctorId);
    }
    if (patientId) {
      matchStage.patientDetails = new mongoose.Types.ObjectId(patientId);
    }

    const pipeline = [
      {
        $match: matchStage,
      },
      {
        $lookup: {
          from: "patients",
          localField: "patientDetails",
          foreignField: "_id",
          as: "patientDetails",
        },
      },
      {
        $unwind: {
          path: "$patientDetails",
          preserveNullAndEmptyArrays: true,
        },
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

app.get("/prescriptions/:id", async (req, res) => {
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

app.post("/prescriptions", async (req, res) => {
  try {
    const { patientDetails, doctorDetails, medicines, description } = req.body;
    const newPrescription = new Prescription({
      patientDetails,
      doctorDetails,
      medicines,
      description,
    });
    await newPrescription.save();
    res.status(201).json(newPrescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/prescriptions/:id", async (req, res) => {
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

app.delete("/prescriptions/:id", async (req, res) => {
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
