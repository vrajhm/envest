import { useState } from "react";
import axios from "axios";

export default function InvestorForm() {
  const [companyName, setCompanyName] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [climateConcerns, setClimateConcerns] = useState([]);
  const [location, setLocation] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);

  const investmentOptions = [
    "10-100k",
    "100-200k",
    "200-500k",
    "500-750k",
    "750k-1mil",
    "+1mil"
  ];

  const concernOptions = [
    "Carbon Reduction",
    "Public Health Impact",
    "Biodiversity Protection",
    "Climate Adaptation",
    "Environmental Justice"
  ];

  const handleConcernChange = (concern) => {
    if (climateConcerns.includes(concern)) {
      setClimateConcerns(climateConcerns.filter(c => c !== concern));
    } else {
      setClimateConcerns([...climateConcerns, concern]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await axios.post("http://localhost:8000/submit-preferences", {
        company_name: companyName,
        investment_amount: investmentAmount,
        climate_concerns: climateConcerns,
        location: location
      });
      alert("Preferences saved!");
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const labelStyle = { display: "block", marginBottom: 6, color: "#3F714B", fontWeight: 500 };
  const inputStyle = {
    width: "100%", maxWidth: 320, padding: "10px 14px", marginBottom: 20,
    border: "1px solid rgba(63, 113, 75, 0.3)", borderRadius: 8,
    background: "#fff", fontSize: 15, outline: "none",
  };
  const checkboxStyle = { accentColor: "#3F714B", marginRight: 10 };

  return (
    <div style={{
      minHeight: "100vh", background: "#F5F5DC", padding: "48px 24px",
      fontFamily: "system-ui, -apple-system, sans-serif", color: "#3F714B",
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Investor Questionnaire
        </h1>
        <p style={{ margin: "0 0 32px", opacity: 0.8, fontSize: 15 }}>
          Tell us about your investment goals and climate priorities.
        </p>

        {error && (
          <div style={{
            padding: 12, marginBottom: 24, background: "rgba(200, 80, 80, 0.12)",
            borderRadius: 8, color: "#b33", fontSize: 14,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 2px 12px rgba(63, 113, 75, 0.08)" }}>
          <label style={labelStyle}>Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Ventures"
            style={inputStyle}
          />

          <label style={labelStyle}>Investment Amount</label>
          <select
            value={investmentAmount}
            onChange={(e) => setInvestmentAmount(e.target.value)}
            required
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="">Select amount</option>
            {investmentOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <label style={{ ...labelStyle, marginTop: 8 }}>Climate Concerns</label>
          <div style={{ marginBottom: 20 }}>
            {concernOptions.map(concern => (
              <label key={concern} style={{ display: "flex", alignItems: "center", marginBottom: 10, cursor: "pointer", fontSize: 15 }}>
                <input
                  type="checkbox"
                  value={concern}
                  checked={climateConcerns.includes(concern)}
                  onChange={() => handleConcernChange(concern)}
                  style={checkboxStyle}
                />
                {concern}
              </label>
            ))}
          </div>

          <label style={labelStyle}>Location (US City)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. San Francisco"
            required
            style={inputStyle}
          />

          <button
            type="submit"
            style={{
              marginTop: 8, padding: "12px 24px", background: "#3F714B", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#335a3d"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#3F714B"; }}
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
