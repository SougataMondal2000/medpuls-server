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
const PDFDocument = require("pdfkit");
const upload = require("./config/cloudinary");

dotenv.config();
const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;
const JWT_SECRET =
  process.env.JWT_SECRET || "23+40FldreX+xJbozW+tYN8Ku/U9v0C14Y9oUSdkw48=";

app.use(bodyParser.json());

const uploadXLSX = multer({ dest: "uploads/" });

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

  const token = authHeader.split(" ")[1];

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

app.post("/signup", upload.single("signature"), async (req, res) => {
  try {
    const { doctorName, email, phoneNo, password, clinicName, clinicAddress } =
      req.body;
    const signature = req.file ? req.file.path : "";

    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ message: "Doctor already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDoctor = new Doctor({
      doctorName,
      email,
      phoneNo,
      clinicName,
      clinicAddress,
      signature,
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

app.get("/prescriptions/download/:id", verifyJWT, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate("patientDetails")
      .populate("doctorDetails");

    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const sanitizedName = prescription.patientDetails.name
      .replace(/\s+/g, "_")
      .toLowerCase();
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${sanitizedName}_prescription.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#2563eb")
      .text(`${prescription.doctorDetails.clinicName}`, { align: "center" });

    doc
      .fontSize(9)
      .fillColor("#64748b")
      .text(
        `${prescription.doctorDetails.clinicAddress.addressLine1}, ${prescription.doctorDetails.clinicAddress.city}, ${prescription.doctorDetails.clinicAddress.state}, Pincode - ${prescription.doctorDetails.clinicAddress.pincode}`,
        {
          align: "center",
        }
      );

    doc.moveDown(0.5);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#0f172a")
      .text(`Dr. ${prescription.doctorDetails.doctorName}`, {
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#475569")
      .text(
        `Email: ${prescription.doctorDetails.email} | Phone: ${prescription.doctorDetails.phoneNo}`,
        {
          align: "center",
        }
      );

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#e2e8f0").stroke();

    const patientBoxY = doc.y;
    doc.rect(50, patientBoxY, 500, 80).fillColor("#f8fafc").fill();

    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("PATIENT INFORMATION", 70, patientBoxY + 10);

    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`Name: ${prescription.patientDetails.name}`, 70, patientBoxY + 30)
      .text(
        `Age: ${prescription.patientDetails.age} | Sex: ${prescription.patientDetails.sex} | Phone: ${prescription.patientDetails.phone}`,
        70,
        patientBoxY + 45
      )
      .text(
        `Address: ${prescription.patientDetails.address.addressLine1}`,
        70,
        patientBoxY + 60
      );

    doc.moveDown(2);
    const vitalsY = doc.y;
    doc.rect(50, vitalsY, 500, 65).fillColor("#f0f9ff").fill();

    doc
      .fillColor("#2563eb")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("VITAL SIGNS & MEASUREMENTS", 60, vitalsY + 10);

    const heightInMeters = parseInt(prescription.patientDetails.height) / 100;
    const weightInKg = parseInt(prescription.patientDetails.weight);
    const bmi = (weightInKg / (heightInMeters * heightInMeters)).toFixed(1);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#0f172a")
      .text("Height:", 70, vitalsY + 30)
      .text("Weight:", 200, vitalsY + 30)
      .text("BMI:", 330, vitalsY + 30)
      .text("Blood Pressure:", 440, vitalsY + 30);

    doc
      .font("Helvetica")
      .text(`${prescription.patientDetails.height} cm`, 110, vitalsY + 30)
      .text(`${prescription.patientDetails.weight} kg`, 240, vitalsY + 30)
      .text(`${bmi} kg/m²`, 355, vitalsY + 30)
      .text(`${prescription.patientDetails.bp}`, 515, vitalsY + 30);

    doc.font("Helvetica-Bold").text("Pulse:", 70, vitalsY + 45);

    doc
      .font("Helvetica")
      .text(`${prescription.patientDetails.pulse} bpm`, 105, vitalsY + 45);

    doc.moveDown(2);
    const descY = doc.y;
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#2563eb")
      .text("DIAGNOSIS & OBSERVATIONS", 50, descY);

    const descriptionText = prescription.description.join("\n");
    const descriptionWidth = 480;
    const textOptions = {
      width: descriptionWidth,
      align: "left",
    };

    const descriptionHeight = doc.heightOfString(descriptionText, {
      width: descriptionWidth,
      align: "left",
    });

    const boxPadding = 20;
    const totalBoxHeight = descriptionHeight + boxPadding * 2;

    doc
      .rect(50, descY + 20, 500, totalBoxHeight)
      .dash(4, { space: 2 })
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#0f172a")
      .text(descriptionText, 60, descY + 20 + boxPadding, textOptions);

    doc.moveDown(2);
    const medicineStartY = doc.y;
    doc.rect(50, medicineStartY, 500, 20).fillColor("#f1f5f9").fill();

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9);

    doc.text("No.", 55, medicineStartY + 6);
    doc.text("Medicine", 85, medicineStartY + 6);
    doc.text("Dosage", 210, medicineStartY + 6);
    doc.text("Frequency", 290, medicineStartY + 6);
    doc.text("Duration", 370, medicineStartY + 6);
    doc.text("Remarks", 440, medicineStartY + 6);

    doc.moveTo(50, medicineStartY).lineTo(550, medicineStartY).stroke();
    doc
      .moveTo(50, medicineStartY + 20)
      .lineTo(550, medicineStartY + 20)
      .stroke();

    const medicineEndY =
      medicineStartY + 20 + prescription.medicines.length * 20;
    [50, 80, 200, 280, 360, 430, 550].forEach((x) => {
      doc.moveTo(x, medicineStartY).lineTo(x, medicineEndY).stroke();
    });

    doc.font("Helvetica").fontSize(9);
    prescription.medicines.forEach((med, index) => {
      const y = medicineStartY + 20 + index * 20;
      doc.text(`${index + 1}.`, 55, y + 6);
      doc.text(med.drug, 85, y + 6);
      doc.text(med.dose, 210, y + 6);
      doc.text(med.frequency, 290, y + 6);
      doc.text(`${med.day} days`, 370, y + 6);
      doc.text(med.remarks || "-", 440, y + 6);
      doc
        .moveTo(50, y + 20)
        .lineTo(550, y + 20)
        .stroke();
    });

    if (prescription.tests.length > 0) {
      doc.moveDown(1);
      const testsStartY = doc.y;
      doc.rect(50, testsStartY, 500, 20).fillColor("#f1f5f9").fill();

      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("RECOMMENDED TESTS", 60, testsStartY + 6);

      doc.moveTo(50, testsStartY).lineTo(550, testsStartY).stroke();
      doc
        .moveTo(50, testsStartY + 20)
        .lineTo(550, testsStartY + 20)
        .stroke();

      const testsEndY = testsStartY + 20 + prescription.tests.length * 20;
      doc.moveTo(50, testsStartY).lineTo(50, testsEndY).stroke();
      doc.moveTo(550, testsStartY).lineTo(550, testsEndY).stroke();

      doc.font("Helvetica").fontSize(9);
      prescription.tests.forEach((test, index) => {
        const y = testsStartY + 20 + index * 20;
        doc.text(`${index + 1}. ${test}`, 60, y + 6);
        doc
          .moveTo(50, y + 20)
          .lineTo(550, y + 20)
          .stroke();
      });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#0f172a")
      .text("Doctor's Signature:", 400, 750);

    if (prescription.doctorDetails.signature) {
      try {
        doc.image(prescription.doctorDetails.signature, 400, 765, {
          width: 100,
          height: 40,
        });
      } catch (error) {
        console.error("Error adding signature:", error);
        doc
          .font("Helvetica")
          .text(`Dr. ${prescription.doctorDetails.doctorName}`, 400, 765);
      }
    } else {
      doc
        .font("Helvetica")
        .text(`Dr. ${prescription.doctorDetails.doctorName}`, 400, 765);
    }

    doc.end();
  } catch (error) {
    console.error("Error generating prescription PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
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
  uploadXLSX.single("file"),
  async (req, res) => {
    try {
      const filePath = req.file.path;
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      const misc = data
        .map((item) => ({
          name: item.name,
          type: item.type,
        }))
        .filter((item) => item.name);

      if (misc.length > 0) {
        await Misc.insertMany(misc);
        res.status(201).json({
          message: `${misc.length} data added successfully.`,
        });
      } else {
        res.status(400).json({ message: "No valid data found in the file." });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
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
