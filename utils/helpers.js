import jwt from "jsonwebtoken";
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret_key',
    { expiresIn: '7d' }
  );
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateApplicationNumber = (postId) => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `APP-${postId}-${timestamp}-${random}`;
};

const generateRollNumber = (postId, applicationIndex) => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const index = applicationIndex.toString().padStart(5, '0');
  return `${postId}-${year}${month}-${index}`;
};

const calculateFeeWithGST = (fee, gstPercentage = 18) => {
  const gstAmount = (fee * gstPercentage) / 100;
  const totalAmount = fee + gstAmount;
  return { baseAmount: fee, gstAmount, totalAmount };
};

const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

module.exports = {
  generateToken,
  generateOTP,
  generateApplicationNumber,
  generateRollNumber,
  calculateFeeWithGST,
  getCurrentTimestamp,
};
