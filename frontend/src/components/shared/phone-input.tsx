"use client";

import { useState } from "react";

type Country = { code: string; iso: string; name: string };

function flagEmoji(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

// Nigeria first (dominant default), then alphabetical by name.
const COUNTRIES: Country[] = [
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+93", iso: "AF", name: "Afghanistan" },
  { code: "+355", iso: "AL", name: "Albania" },
  { code: "+213", iso: "DZ", name: "Algeria" },
  { code: "+1684", iso: "AS", name: "American Samoa" },
  { code: "+376", iso: "AD", name: "Andorra" },
  { code: "+244", iso: "AO", name: "Angola" },
  { code: "+1264", iso: "AI", name: "Anguilla" },
  { code: "+1268", iso: "AG", name: "Antigua and Barbuda" },
  { code: "+54", iso: "AR", name: "Argentina" },
  { code: "+374", iso: "AM", name: "Armenia" },
  { code: "+297", iso: "AW", name: "Aruba" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+43", iso: "AT", name: "Austria" },
  { code: "+994", iso: "AZ", name: "Azerbaijan" },
  { code: "+1242", iso: "BS", name: "Bahamas" },
  { code: "+973", iso: "BH", name: "Bahrain" },
  { code: "+880", iso: "BD", name: "Bangladesh" },
  { code: "+1246", iso: "BB", name: "Barbados" },
  { code: "+375", iso: "BY", name: "Belarus" },
  { code: "+32", iso: "BE", name: "Belgium" },
  { code: "+501", iso: "BZ", name: "Belize" },
  { code: "+229", iso: "BJ", name: "Benin" },
  { code: "+1441", iso: "BM", name: "Bermuda" },
  { code: "+975", iso: "BT", name: "Bhutan" },
  { code: "+591", iso: "BO", name: "Bolivia" },
  { code: "+387", iso: "BA", name: "Bosnia and Herzegovina" },
  { code: "+267", iso: "BW", name: "Botswana" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+673", iso: "BN", name: "Brunei" },
  { code: "+359", iso: "BG", name: "Bulgaria" },
  { code: "+226", iso: "BF", name: "Burkina Faso" },
  { code: "+257", iso: "BI", name: "Burundi" },
  { code: "+855", iso: "KH", name: "Cambodia" },
  { code: "+237", iso: "CM", name: "Cameroon" },
  { code: "+1", iso: "CA", name: "Canada" },
  { code: "+238", iso: "CV", name: "Cape Verde" },
  { code: "+1345", iso: "KY", name: "Cayman Islands" },
  { code: "+236", iso: "CF", name: "Central African Republic" },
  { code: "+235", iso: "TD", name: "Chad" },
  { code: "+56", iso: "CL", name: "Chile" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+57", iso: "CO", name: "Colombia" },
  { code: "+269", iso: "KM", name: "Comoros" },
  { code: "+242", iso: "CG", name: "Congo" },
  { code: "+243", iso: "CD", name: "DR Congo" },
  { code: "+682", iso: "CK", name: "Cook Islands" },
  { code: "+506", iso: "CR", name: "Costa Rica" },
  { code: "+225", iso: "CI", name: "Côte d'Ivoire" },
  { code: "+385", iso: "HR", name: "Croatia" },
  { code: "+53", iso: "CU", name: "Cuba" },
  { code: "+357", iso: "CY", name: "Cyprus" },
  { code: "+420", iso: "CZ", name: "Czech Republic" },
  { code: "+45", iso: "DK", name: "Denmark" },
  { code: "+253", iso: "DJ", name: "Djibouti" },
  { code: "+1767", iso: "DM", name: "Dominica" },
  { code: "+1809", iso: "DO", name: "Dominican Republic" },
  { code: "+593", iso: "EC", name: "Ecuador" },
  { code: "+20", iso: "EG", name: "Egypt" },
  { code: "+503", iso: "SV", name: "El Salvador" },
  { code: "+240", iso: "GQ", name: "Equatorial Guinea" },
  { code: "+291", iso: "ER", name: "Eritrea" },
  { code: "+372", iso: "EE", name: "Estonia" },
  { code: "+268", iso: "SZ", name: "Eswatini" },
  { code: "+251", iso: "ET", name: "Ethiopia" },
  { code: "+500", iso: "FK", name: "Falkland Islands" },
  { code: "+298", iso: "FO", name: "Faroe Islands" },
  { code: "+679", iso: "FJ", name: "Fiji" },
  { code: "+358", iso: "FI", name: "Finland" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+594", iso: "GF", name: "French Guiana" },
  { code: "+689", iso: "PF", name: "French Polynesia" },
  { code: "+241", iso: "GA", name: "Gabon" },
  { code: "+220", iso: "GM", name: "Gambia" },
  { code: "+995", iso: "GE", name: "Georgia" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+233", iso: "GH", name: "Ghana" },
  { code: "+350", iso: "GI", name: "Gibraltar" },
  { code: "+30", iso: "GR", name: "Greece" },
  { code: "+299", iso: "GL", name: "Greenland" },
  { code: "+1473", iso: "GD", name: "Grenada" },
  { code: "+590", iso: "GP", name: "Guadeloupe" },
  { code: "+1671", iso: "GU", name: "Guam" },
  { code: "+502", iso: "GT", name: "Guatemala" },
  { code: "+224", iso: "GN", name: "Guinea" },
  { code: "+245", iso: "GW", name: "Guinea-Bissau" },
  { code: "+592", iso: "GY", name: "Guyana" },
  { code: "+509", iso: "HT", name: "Haiti" },
  { code: "+504", iso: "HN", name: "Honduras" },
  { code: "+852", iso: "HK", name: "Hong Kong" },
  { code: "+36", iso: "HU", name: "Hungary" },
  { code: "+354", iso: "IS", name: "Iceland" },
  { code: "+91", iso: "IN", name: "India" },
  { code: "+62", iso: "ID", name: "Indonesia" },
  { code: "+98", iso: "IR", name: "Iran" },
  { code: "+964", iso: "IQ", name: "Iraq" },
  { code: "+353", iso: "IE", name: "Ireland" },
  { code: "+972", iso: "IL", name: "Israel" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+1876", iso: "JM", name: "Jamaica" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+962", iso: "JO", name: "Jordan" },
  { code: "+7", iso: "KZ", name: "Kazakhstan" },
  { code: "+254", iso: "KE", name: "Kenya" },
  { code: "+686", iso: "KI", name: "Kiribati" },
  { code: "+850", iso: "KP", name: "North Korea" },
  { code: "+82", iso: "KR", name: "South Korea" },
  { code: "+965", iso: "KW", name: "Kuwait" },
  { code: "+996", iso: "KG", name: "Kyrgyzstan" },
  { code: "+856", iso: "LA", name: "Laos" },
  { code: "+371", iso: "LV", name: "Latvia" },
  { code: "+961", iso: "LB", name: "Lebanon" },
  { code: "+266", iso: "LS", name: "Lesotho" },
  { code: "+231", iso: "LR", name: "Liberia" },
  { code: "+218", iso: "LY", name: "Libya" },
  { code: "+423", iso: "LI", name: "Liechtenstein" },
  { code: "+370", iso: "LT", name: "Lithuania" },
  { code: "+352", iso: "LU", name: "Luxembourg" },
  { code: "+853", iso: "MO", name: "Macau" },
  { code: "+389", iso: "MK", name: "North Macedonia" },
  { code: "+261", iso: "MG", name: "Madagascar" },
  { code: "+265", iso: "MW", name: "Malawi" },
  { code: "+60", iso: "MY", name: "Malaysia" },
  { code: "+960", iso: "MV", name: "Maldives" },
  { code: "+223", iso: "ML", name: "Mali" },
  { code: "+356", iso: "MT", name: "Malta" },
  { code: "+692", iso: "MH", name: "Marshall Islands" },
  { code: "+596", iso: "MQ", name: "Martinique" },
  { code: "+222", iso: "MR", name: "Mauritania" },
  { code: "+230", iso: "MU", name: "Mauritius" },
  { code: "+262", iso: "YT", name: "Mayotte" },
  { code: "+52", iso: "MX", name: "Mexico" },
  { code: "+691", iso: "FM", name: "Micronesia" },
  { code: "+373", iso: "MD", name: "Moldova" },
  { code: "+377", iso: "MC", name: "Monaco" },
  { code: "+976", iso: "MN", name: "Mongolia" },
  { code: "+382", iso: "ME", name: "Montenegro" },
  { code: "+1664", iso: "MS", name: "Montserrat" },
  { code: "+212", iso: "MA", name: "Morocco" },
  { code: "+258", iso: "MZ", name: "Mozambique" },
  { code: "+95", iso: "MM", name: "Myanmar" },
  { code: "+264", iso: "NA", name: "Namibia" },
  { code: "+674", iso: "NR", name: "Nauru" },
  { code: "+977", iso: "NP", name: "Nepal" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+687", iso: "NC", name: "New Caledonia" },
  { code: "+64", iso: "NZ", name: "New Zealand" },
  { code: "+505", iso: "NI", name: "Nicaragua" },
  { code: "+227", iso: "NE", name: "Niger" },
  { code: "+1670", iso: "MP", name: "Northern Mariana Islands" },
  { code: "+47", iso: "NO", name: "Norway" },
  { code: "+968", iso: "OM", name: "Oman" },
  { code: "+92", iso: "PK", name: "Pakistan" },
  { code: "+680", iso: "PW", name: "Palau" },
  { code: "+970", iso: "PS", name: "Palestine" },
  { code: "+507", iso: "PA", name: "Panama" },
  { code: "+675", iso: "PG", name: "Papua New Guinea" },
  { code: "+595", iso: "PY", name: "Paraguay" },
  { code: "+51", iso: "PE", name: "Peru" },
  { code: "+63", iso: "PH", name: "Philippines" },
  { code: "+48", iso: "PL", name: "Poland" },
  { code: "+351", iso: "PT", name: "Portugal" },
  { code: "+1787", iso: "PR", name: "Puerto Rico" },
  { code: "+974", iso: "QA", name: "Qatar" },
  { code: "+262", iso: "RE", name: "Réunion" },
  { code: "+40", iso: "RO", name: "Romania" },
  { code: "+7", iso: "RU", name: "Russia" },
  { code: "+250", iso: "RW", name: "Rwanda" },
  { code: "+590", iso: "BL", name: "Saint Barthélemy" },
  { code: "+290", iso: "SH", name: "Saint Helena" },
  { code: "+1869", iso: "KN", name: "Saint Kitts and Nevis" },
  { code: "+1758", iso: "LC", name: "Saint Lucia" },
  { code: "+590", iso: "MF", name: "Saint Martin" },
  { code: "+508", iso: "PM", name: "Saint Pierre and Miquelon" },
  { code: "+1784", iso: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "+685", iso: "WS", name: "Samoa" },
  { code: "+378", iso: "SM", name: "San Marino" },
  { code: "+239", iso: "ST", name: "São Tomé and Príncipe" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+221", iso: "SN", name: "Senegal" },
  { code: "+381", iso: "RS", name: "Serbia" },
  { code: "+248", iso: "SC", name: "Seychelles" },
  { code: "+232", iso: "SL", name: "Sierra Leone" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+1721", iso: "SX", name: "Sint Maarten" },
  { code: "+421", iso: "SK", name: "Slovakia" },
  { code: "+386", iso: "SI", name: "Slovenia" },
  { code: "+677", iso: "SB", name: "Solomon Islands" },
  { code: "+252", iso: "SO", name: "Somalia" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+211", iso: "SS", name: "South Sudan" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+94", iso: "LK", name: "Sri Lanka" },
  { code: "+249", iso: "SD", name: "Sudan" },
  { code: "+597", iso: "SR", name: "Suriname" },
  { code: "+46", iso: "SE", name: "Sweden" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+963", iso: "SY", name: "Syria" },
  { code: "+886", iso: "TW", name: "Taiwan" },
  { code: "+992", iso: "TJ", name: "Tajikistan" },
  { code: "+255", iso: "TZ", name: "Tanzania" },
  { code: "+66", iso: "TH", name: "Thailand" },
  { code: "+670", iso: "TL", name: "Timor-Leste" },
  { code: "+228", iso: "TG", name: "Togo" },
  { code: "+690", iso: "TK", name: "Tokelau" },
  { code: "+676", iso: "TO", name: "Tonga" },
  { code: "+1868", iso: "TT", name: "Trinidad and Tobago" },
  { code: "+216", iso: "TN", name: "Tunisia" },
  { code: "+90", iso: "TR", name: "Turkey" },
  { code: "+993", iso: "TM", name: "Turkmenistan" },
  { code: "+1649", iso: "TC", name: "Turks and Caicos" },
  { code: "+688", iso: "TV", name: "Tuvalu" },
  { code: "+256", iso: "UG", name: "Uganda" },
  { code: "+380", iso: "UA", name: "Ukraine" },
  { code: "+971", iso: "AE", name: "United Arab Emirates" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+1", iso: "US", name: "United States" },
  { code: "+598", iso: "UY", name: "Uruguay" },
  { code: "+998", iso: "UZ", name: "Uzbekistan" },
  { code: "+678", iso: "VU", name: "Vanuatu" },
  { code: "+39", iso: "VA", name: "Vatican City" },
  { code: "+58", iso: "VE", name: "Venezuela" },
  { code: "+84", iso: "VN", name: "Vietnam" },
  { code: "+1284", iso: "VG", name: "British Virgin Islands" },
  { code: "+1340", iso: "VI", name: "U.S. Virgin Islands" },
  { code: "+681", iso: "WF", name: "Wallis and Futuna" },
  { code: "+967", iso: "YE", name: "Yemen" },
  { code: "+260", iso: "ZM", name: "Zambia" },
  { code: "+263", iso: "ZW", name: "Zimbabwe" },
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
};

export function PhoneInput({
  value,
  onChange,
  placeholder = "Phone number",
  required,
  className = "",
  inputClassName = "",
}: Props) {
  const match = COUNTRIES.find((c) => c.code !== "" && value.startsWith(c.code));
  const selected = match || COUNTRIES[0];

  const displayValue = selected && value.startsWith(selected.code)
    ? value.slice(selected.code.length)
    : value;

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const codeDigits = selected.code.replace(/\D/g, "");
    const num = raw.startsWith(codeDigits) ? raw.slice(codeDigits.length) : raw;
    onChange(`${selected.code}${num}`);
  };

  const handleCodeChange = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
    const num = value.replace(/^\+\d+/, "");
    onChange(num ? `${country.code}${num}` : "");
  };

  return (
    <div className={`flex rounded-lg border border-slate-200 bg-white overflow-hidden h-10 ${className}`}>
      <select
        value={selected.code}
        onChange={(e) => handleCodeChange(e.target.value)}
        className="flex-shrink-0 border-r border-slate-200 bg-slate-50 pl-2 pr-1 text-sm outline-none max-w-[132px]"
        aria-label="Country code"
      >
        {COUNTRIES.map((c) => (
          <option key={`${c.iso}-${c.code}`} value={c.code}>
            {flagEmoji(c.iso)} {c.iso} {c.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={displayValue}
        onChange={handleNumberChange}
        placeholder={placeholder}
        required={required}
        className={`flex-1 bg-transparent px-3 py-2 text-sm outline-none min-w-0 ${inputClassName}`}
      />
    </div>
  );
}
