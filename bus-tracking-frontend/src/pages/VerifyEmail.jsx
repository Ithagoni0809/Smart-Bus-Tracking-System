import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { authAPI } from "../services/api";

const VerifyEmail = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await authAPI.verifyEmail(token);

        setVerified(true);
        setMessage(res.data.message);
      } catch (err) {
        setVerified(false);
        setMessage(
          err.response?.data?.message ||
          "Verification failed."
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <h2 className="text-2xl font-semibold">
          Verifying your email...
        </h2>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <div className="card max-w-md w-full text-center p-8">

        <h1 className="text-3xl font-bold mb-4">
          {verified ? "✅ Email Verified" : "❌ Verification Failed"}
        </h1>

        <p className="mb-6">{message}</p>

        <Link to="/login" className="btn-primary">
          Go to Login
        </Link>

      </div>
    </div>
  );
};

export default VerifyEmail;