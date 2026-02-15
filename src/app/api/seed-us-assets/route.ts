import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface AssetRow {
  ticker: string;
  name: string;
  asset_type: "us_stock" | "us_etf";
  currency: "USD";
  exchange: string;
  is_active: true;
}

// S&P 500 + popular US stocks
const US_STOCKS: [string, string, string][] = [
  // Tech
  ["AAPL","Apple Inc","NASDAQ"],["MSFT","Microsoft Corp","NASDAQ"],["GOOGL","Alphabet Inc Class A","NASDAQ"],
  ["GOOG","Alphabet Inc Class C","NASDAQ"],["AMZN","Amazon.com Inc","NASDAQ"],["NVDA","NVIDIA Corp","NASDAQ"],
  ["TSLA","Tesla Inc","NASDAQ"],["META","Meta Platforms Inc","NASDAQ"],["AVGO","Broadcom Inc","NASDAQ"],
  ["ORCL","Oracle Corp","NYSE"],["CRM","Salesforce Inc","NYSE"],["AMD","Advanced Micro Devices","NASDAQ"],
  ["ADBE","Adobe Inc","NASDAQ"],["INTC","Intel Corp","NASDAQ"],["CSCO","Cisco Systems","NASDAQ"],
  ["QCOM","Qualcomm Inc","NASDAQ"],["TXN","Texas Instruments","NASDAQ"],["INTU","Intuit Inc","NASDAQ"],
  ["AMAT","Applied Materials","NASDAQ"],["MU","Micron Technology","NASDAQ"],["LRCX","Lam Research","NASDAQ"],
  ["KLAC","KLA Corp","NASDAQ"],["SNPS","Synopsys Inc","NASDAQ"],["CDNS","Cadence Design Systems","NASDAQ"],
  ["NFLX","Netflix Inc","NASDAQ"],["PLTR","Palantir Technologies","NYSE"],["NOW","ServiceNow Inc","NYSE"],
  ["UBER","Uber Technologies","NYSE"],["SHOP","Shopify Inc","NYSE"],["SQ","Block Inc","NYSE"],
  ["SNOW","Snowflake Inc","NYSE"],["NET","Cloudflare Inc","NYSE"],["CRWD","CrowdStrike Holdings","NASDAQ"],
  ["PANW","Palo Alto Networks","NASDAQ"],["DDOG","Datadog Inc","NASDAQ"],["ZS","Zscaler Inc","NASDAQ"],
  ["MSTR","MicroStrategy Inc","NASDAQ"],["ARM","Arm Holdings","NASDAQ"],["TEAM","Atlassian Corp","NASDAQ"],
  ["TTD","The Trade Desk","NASDAQ"],["HUBS","HubSpot Inc","NYSE"],["OKTA","Okta Inc","NASDAQ"],
  ["MDB","MongoDB Inc","NASDAQ"],["TWLO","Twilio Inc","NYSE"],["PATH","UiPath Inc","NYSE"],
  ["S","SentinelOne Inc","NYSE"],["SMCI","Super Micro Computer","NASDAQ"],["APP","AppLovin Corp","NASDAQ"],
  ["ANET","Arista Networks","NYSE"],["ASML","ASML Holding","NASDAQ"],["TSM","Taiwan Semiconductor","NYSE"],
  ["DELL","Dell Technologies","NYSE"],["HPQ","HP Inc","NYSE"],["IBM","IBM Corp","NYSE"],
  ["WDAY","Workday Inc","NASDAQ"],["VEEV","Veeva Systems","NYSE"],["ZM","Zoom Video","NASDAQ"],
  ["DOCU","DocuSign Inc","NASDAQ"],["ESTC","Elastic NV","NYSE"],["DKNG","DraftKings Inc","NASDAQ"],
  ["RBLX","Roblox Corp","NYSE"],["U","Unity Software","NYSE"],["EA","Electronic Arts","NASDAQ"],
  ["TTWO","Take-Two Interactive","NASDAQ"],["SPOT","Spotify Technology","NYSE"],["PINS","Pinterest Inc","NYSE"],
  ["SNAP","Snap Inc","NYSE"],["ROKU","Roku Inc","NASDAQ"],["WBD","Warner Bros Discovery","NASDAQ"],
  ["PARA","Paramount Global","NASDAQ"],["DASH","DoorDash Inc","NASDAQ"],["GRAB","Grab Holdings","NASDAQ"],
  ["LYFT","Lyft Inc","NASDAQ"],["ABNB","Airbnb Inc","NASDAQ"],["BKNG","Booking Holdings","NASDAQ"],
  ["CPRT","Copart Inc","NASDAQ"],["MRVL","Marvell Technology","NASDAQ"],["ON","ON Semiconductor","NASDAQ"],
  ["ENPH","Enphase Energy","NASDAQ"],["FSLR","First Solar","NASDAQ"],["SEDG","SolarEdge Technologies","NASDAQ"],
  ["MSI","Motorola Solutions","NYSE"],["GEV","GE Vernova","NYSE"],["CELH","Celsius Holdings","NASDAQ"],
  ["VST","Vistra Corp","NYSE"],["CEG","Constellation Energy","NASDAQ"],
  // Finance
  ["JPM","JPMorgan Chase","NYSE"],["V","Visa Inc","NYSE"],["MA","Mastercard Inc","NYSE"],
  ["BAC","Bank of America","NYSE"],["WFC","Wells Fargo","NYSE"],["GS","Goldman Sachs","NYSE"],
  ["MS","Morgan Stanley","NYSE"],["BLK","BlackRock Inc","NYSE"],["SCHW","Charles Schwab","NYSE"],
  ["C","Citigroup Inc","NYSE"],["AXP","American Express","NYSE"],["PYPL","PayPal Holdings","NASDAQ"],
  ["COIN","Coinbase Global","NASDAQ"],["HOOD","Robinhood Markets","NASDAQ"],["SOFI","SoFi Technologies","NASDAQ"],
  ["ICE","Intercontinental Exchange","NYSE"],["CME","CME Group","NASDAQ"],["SPGI","S&P Global","NYSE"],
  ["MCO","Moodys Corp","NYSE"],["MSCI","MSCI Inc","NYSE"],["FIS","Fidelity National Info","NYSE"],
  ["FISV","Fiserv Inc","NYSE"],["ADP","Automatic Data Processing","NASDAQ"],["TROW","T Rowe Price","NASDAQ"],
  ["BEN","Franklin Resources","NYSE"],["STT","State Street Corp","NYSE"],["NTRS","Northern Trust","NASDAQ"],
  ["PNC","PNC Financial","NYSE"],["TFC","Truist Financial","NYSE"],["USB","US Bancorp","NYSE"],
  ["FITB","Fifth Third Bancorp","NASDAQ"],["CFG","Citizens Financial","NYSE"],["KEY","KeyCorp","NYSE"],
  ["HBAN","Huntington Bancshares","NASDAQ"],["ALLY","Ally Financial","NYSE"],["SYF","Synchrony Financial","NYSE"],
  ["NU","Nu Holdings","NYSE"],["XP","XP Inc","NASDAQ"],["MELI","MercadoLibre Inc","NASDAQ"],
  ["STNE","StoneCo Ltd","NASDAQ"],["PAGS","PagSeguro Digital","NYSE"],
  // Healthcare
  ["UNH","UnitedHealth Group","NYSE"],["JNJ","Johnson & Johnson","NYSE"],["LLY","Eli Lilly","NYSE"],
  ["ABBV","AbbVie Inc","NYSE"],["MRK","Merck & Co","NYSE"],["PFE","Pfizer Inc","NYSE"],
  ["TMO","Thermo Fisher Scientific","NYSE"],["ABT","Abbott Laboratories","NYSE"],["DHR","Danaher Corp","NYSE"],
  ["BMY","Bristol-Myers Squibb","NYSE"],["AMGN","Amgen Inc","NASDAQ"],["GILD","Gilead Sciences","NASDAQ"],
  ["ISRG","Intuitive Surgical","NASDAQ"],["MRNA","Moderna Inc","NASDAQ"],["REGN","Regeneron","NASDAQ"],
  ["VRTX","Vertex Pharmaceuticals","NASDAQ"],["BIIB","Biogen Inc","NASDAQ"],["ZTS","Zoetis Inc","NYSE"],
  ["IDXX","IDEXX Laboratories","NASDAQ"],["DXCM","DexCom Inc","NASDAQ"],["ALGN","Align Technology","NASDAQ"],
  ["SYK","Stryker Corp","NYSE"],["MDT","Medtronic plc","NYSE"],["EW","Edwards Lifesciences","NYSE"],
  ["BSX","Boston Scientific","NYSE"],["ZBH","Zimmer Biomet","NYSE"],["STE","STERIS plc","NYSE"],
  ["A","Agilent Technologies","NYSE"],["WAT","Waters Corp","NYSE"],["BIO","Bio-Rad Laboratories","NYSE"],
  ["ILMN","Illumina Inc","NASDAQ"],["HCA","HCA Healthcare","NYSE"],["ELV","Elevance Health","NYSE"],
  ["CI","Cigna Group","NYSE"],["CVS","CVS Health","NYSE"],["WBA","Walgreens Boots Alliance","NASDAQ"],
  // Consumer
  ["KO","Coca-Cola Co","NYSE"],["PEP","PepsiCo Inc","NASDAQ"],["PG","Procter & Gamble","NYSE"],
  ["COST","Costco Wholesale","NASDAQ"],["WMT","Walmart Inc","NYSE"],["NKE","Nike Inc","NYSE"],
  ["MCD","McDonalds Corp","NYSE"],["SBUX","Starbucks Corp","NASDAQ"],["DIS","Walt Disney Co","NYSE"],
  ["HD","Home Depot","NYSE"],["LOW","Lowes Companies","NYSE"],["TGT","Target Corp","NYSE"],
  ["TJX","TJX Companies","NYSE"],["ROST","Ross Stores","NASDAQ"],["DG","Dollar General","NYSE"],
  ["DLTR","Dollar Tree","NASDAQ"],["KHC","Kraft Heinz","NASDAQ"],["MNST","Monster Beverage","NASDAQ"],
  ["KDP","Keurig Dr Pepper","NASDAQ"],["HSY","Hershey Co","NYSE"],["GIS","General Mills","NYSE"],
  ["K","Kellanova","NYSE"],["SJM","J M Smucker","NYSE"],["CAG","Conagra Brands","NYSE"],
  ["CPB","Campbell Soup","NYSE"],["CL","Colgate-Palmolive","NYSE"],["KMB","Kimberly-Clark","NYSE"],
  ["CHD","Church & Dwight","NYSE"],["CLX","Clorox Co","NYSE"],["EL","Estee Lauder","NYSE"],
  ["KVUE","Kenvue Inc","NYSE"],["MAR","Marriott Intl","NASDAQ"],["HLT","Hilton Worldwide","NYSE"],
  ["CMG","Chipotle Mexican Grill","NYSE"],["YUM","Yum Brands","NYSE"],["DPZ","Dominos Pizza","NYSE"],
  ["ORLY","OReilly Automotive","NASDAQ"],["AZO","AutoZone Inc","NYSE"],["AAP","Advance Auto Parts","NYSE"],
  ["BBY","Best Buy","NYSE"],["TSCO","Tractor Supply","NASDAQ"],["EBAY","eBay Inc","NASDAQ"],
  ["ETSY","Etsy Inc","NASDAQ"],["W","Wayfair Inc","NYSE"],["CHWY","Chewy Inc","NYSE"],
  // Industrial / Energy
  ["XOM","Exxon Mobil","NYSE"],["CVX","Chevron Corp","NYSE"],["COP","ConocoPhillips","NYSE"],
  ["EOG","EOG Resources","NYSE"],["SLB","Schlumberger","NYSE"],["OXY","Occidental Petroleum","NYSE"],
  ["MPC","Marathon Petroleum","NYSE"],["PSX","Phillips 66","NYSE"],["VLO","Valero Energy","NYSE"],
  ["PXD","Pioneer Natural Resources","NYSE"],["FANG","Diamondback Energy","NASDAQ"],["DVN","Devon Energy","NYSE"],
  ["HAL","Halliburton Co","NYSE"],["BA","Boeing Co","NYSE"],["CAT","Caterpillar Inc","NYSE"],
  ["GE","GE Aerospace","NYSE"],["RTX","RTX Corp","NYSE"],["LMT","Lockheed Martin","NYSE"],
  ["NOC","Northrop Grumman","NYSE"],["GD","General Dynamics","NYSE"],["HII","Huntington Ingalls","NYSE"],
  ["HON","Honeywell Intl","NASDAQ"],["UPS","United Parcel Service","NYSE"],["FDX","FedEx Corp","NYSE"],
  ["DE","Deere & Co","NYSE"],["EMR","Emerson Electric","NYSE"],["ROK","Rockwell Automation","NYSE"],
  ["ETN","Eaton Corp","NYSE"],["ITW","Illinois Tool Works","NYSE"],["MMM","3M Company","NYSE"],
  ["SHW","Sherwin-Williams","NYSE"],["ECL","Ecolab Inc","NYSE"],["APD","Air Products","NYSE"],
  ["LIN","Linde plc","NASDAQ"],["FCX","Freeport-McMoRan","NYSE"],["NEM","Newmont Corp","NYSE"],
  ["GOLD","Barrick Gold","NYSE"],
  // Telecom / Utilities
  ["T","AT&T Inc","NYSE"],["VZ","Verizon Communications","NYSE"],["TMUS","T-Mobile US","NASDAQ"],
  ["CMCSA","Comcast Corp","NASDAQ"],["NEE","NextEra Energy","NYSE"],["DUK","Duke Energy","NYSE"],
  ["SO","Southern Co","NYSE"],["D","Dominion Energy","NYSE"],["AEP","American Electric Power","NASDAQ"],
  ["XEL","Xcel Energy","NASDAQ"],["WEC","WEC Energy","NYSE"],["ES","Eversource Energy","NYSE"],
  ["ED","Consolidated Edison","NYSE"],["EXC","Exelon Corp","NASDAQ"],["SRE","Sempra","NYSE"],
  ["PEG","PSEG Inc","NYSE"],["AWK","American Water Works","NYSE"],
  // Transport
  ["DAL","Delta Air Lines","NYSE"],["UAL","United Airlines","NASDAQ"],["LUV","Southwest Airlines","NYSE"],
  ["AAL","American Airlines","NASDAQ"],["UNP","Union Pacific","NYSE"],["CSX","CSX Corp","NASDAQ"],
  ["NSC","Norfolk Southern","NYSE"],
  // Other
  ["BRK.B","Berkshire Hathaway B","NYSE"],["BRK.A","Berkshire Hathaway A","NYSE"],
  ["F","Ford Motor","NYSE"],["GM","General Motors","NYSE"],["RIVN","Rivian Automotive","NASDAQ"],
  ["LCID","Lucid Group","NASDAQ"],["NIO","NIO Inc","NYSE"],["LI","Li Auto","NASDAQ"],
  ["XPEV","XPeng Inc","NYSE"],["SE","Sea Limited","NYSE"],["BIDU","Baidu Inc","NASDAQ"],
  ["JD","JD.com Inc","NASDAQ"],["PDD","PDD Holdings","NASDAQ"],["BABA","Alibaba Group","NYSE"],
  ["BILI","Bilibili Inc","NASDAQ"],["ZTO","ZTO Express","NYSE"],["NIO","NIO Inc","NYSE"],
  ["MARA","Marathon Digital","NASDAQ"],["RIOT","Riot Platforms","NASDAQ"],["CLSK","CleanSpark","NASDAQ"],
  ["MET","MetLife Inc","NYSE"],["PRU","Prudential Financial","NYSE"],["AFL","Aflac Inc","NYSE"],
  ["ALL","Allstate Corp","NYSE"],["TRV","Travelers Companies","NYSE"],["CB","Chubb Ltd","NYSE"],
  ["AON","Aon plc","NYSE"],["MMC","Marsh & McLennan","NYSE"],["AIG","American Intl Group","NYSE"],
  ["ACGL","Arch Capital Group","NASDAQ"],
];

// Popular US ETFs
const US_ETFS: [string, string, string][] = [
  // Index
  ["VOO","Vanguard S&P 500 ETF","NYSE"],["SPY","SPDR S&P 500 ETF","NYSE"],
  ["IVV","iShares Core S&P 500 ETF","NYSE"],["QQQ","Invesco QQQ Trust","NASDAQ"],
  ["VTI","Vanguard Total Stock Market ETF","NYSE"],["DIA","SPDR Dow Jones Industrial ETF","NYSE"],
  ["IWM","iShares Russell 2000 ETF","NYSE"],["VUG","Vanguard Growth ETF","NYSE"],
  ["VTV","Vanguard Value ETF","NYSE"],["RSP","Invesco S&P 500 Equal Weight","NYSE"],
  ["MGK","Vanguard Mega Cap Growth ETF","NYSE"],["SPLG","SPDR Portfolio S&P 500 ETF","NYSE"],
  ["QQQM","Invesco NASDAQ 100 ETF","NASDAQ"],["SCHX","Schwab US Large-Cap ETF","NYSE"],
  ["SCHA","Schwab US Small-Cap ETF","NYSE"],["SCHG","Schwab US Large-Cap Growth ETF","NYSE"],
  ["SCHV","Schwab US Large-Cap Value ETF","NYSE"],
  // Dividend
  ["SCHD","Schwab US Dividend Equity ETF","NYSE"],["VYM","Vanguard High Dividend Yield ETF","NYSE"],
  ["DVY","iShares Select Dividend ETF","NASDAQ"],["HDV","iShares Core High Dividend ETF","NYSE"],
  ["JEPI","JPMorgan Equity Premium Income ETF","NYSE"],["JEPQ","JPMorgan Nasdaq Equity Premium Income","NASDAQ"],
  ["DGRO","iShares Core Dividend Growth ETF","NYSE"],["DGRW","WisdomTree US Quality Div Growth","NASDAQ"],
  ["NOBL","ProShares S&P 500 Dividend Aristocrats","NYSE"],["SDY","SPDR S&P Dividend ETF","NYSE"],
  ["SPYD","SPDR Portfolio S&P 500 High Div","NYSE"],["SPHD","Invesco S&P 500 High Div Low Vol","NYSE"],
  ["XYLD","Global X S&P 500 Covered Call ETF","NYSE"],["QYLD","Global X NASDAQ 100 Covered Call","NASDAQ"],
  ["RYLD","Global X Russell 2000 Covered Call","NYSE"],["DIVO","Amplify CWP Enhanced Div Income","NYSE"],
  // International
  ["VEA","Vanguard FTSE Developed Markets ETF","NYSE"],["VWO","Vanguard FTSE Emerging Markets ETF","NYSE"],
  ["VXUS","Vanguard Total Intl Stock ETF","NASDAQ"],["EWZ","iShares MSCI Brazil ETF","NYSE"],
  ["EEM","iShares MSCI Emerging Markets ETF","NYSE"],["IEMG","iShares Core MSCI EM ETF","NYSE"],
  ["EFA","iShares MSCI EAFE ETF","NYSE"],["ACWI","iShares MSCI ACWI ETF","NASDAQ"],
  ["IXUS","iShares Core MSCI Total Intl Stock","NASDAQ"],["SCHF","Schwab Intl Equity ETF","NYSE"],
  ["SCHE","Schwab Emerging Markets ETF","NYSE"],["FXI","iShares China Large-Cap ETF","NYSE"],
  ["MCHI","iShares MSCI China ETF","NASDAQ"],["KWEB","KraneShares CSI China Internet ETF","NYSE"],
  ["EWJ","iShares MSCI Japan ETF","NYSE"],["EWG","iShares MSCI Germany ETF","NYSE"],
  ["EWU","iShares MSCI United Kingdom ETF","NYSE"],["EWY","iShares MSCI South Korea ETF","NYSE"],
  ["EWT","iShares MSCI Taiwan ETF","NYSE"],["INDA","iShares MSCI India ETF","NYSE"],
  // Bond
  ["BND","Vanguard Total Bond Market ETF","NASDAQ"],["AGG","iShares Core US Aggregate Bond ETF","NYSE"],
  ["TLT","iShares 20+ Year Treasury Bond ETF","NASDAQ"],["SHY","iShares 1-3 Year Treasury Bond ETF","NASDAQ"],
  ["IEF","iShares 7-10 Year Treasury Bond ETF","NASDAQ"],["VCIT","Vanguard Interm Corp Bond ETF","NASDAQ"],
  ["LQD","iShares iBoxx Investment Grade Corp","NYSE"],["HYG","iShares iBoxx High Yield Corp Bond","NYSE"],
  ["JNK","SPDR Bloomberg High Yield Bond ETF","NYSE"],["TIPS","iShares TIPS Bond ETF","NYSE"],
  ["SCHZ","Schwab US Aggregate Bond ETF","NYSE"],["GOVT","iShares US Treasury Bond ETF","NYSE"],
  ["BNDX","Vanguard Total Intl Bond ETF","NASDAQ"],["EMB","iShares JP Morgan USD EM Bond","NYSE"],
  ["MUB","iShares National Muni Bond ETF","NYSE"],["VTEB","Vanguard Tax-Exempt Bond ETF","NYSE"],
  ["BSV","Vanguard Short-Term Bond ETF","NYSE"],["BIV","Vanguard Interm-Term Bond ETF","NYSE"],
  ["BLV","Vanguard Long-Term Bond ETF","NYSE"],["VCSH","Vanguard Short-Term Corp Bond ETF","NASDAQ"],
  // Sector
  ["XLK","Technology Select Sector SPDR","NYSE"],["XLF","Financial Select Sector SPDR","NYSE"],
  ["XLV","Health Care Select Sector SPDR","NYSE"],["XLE","Energy Select Sector SPDR","NYSE"],
  ["XLI","Industrial Select Sector SPDR","NYSE"],["XLP","Consumer Staples Select Sector SPDR","NYSE"],
  ["XLY","Consumer Discretionary Select SPDR","NYSE"],["XLU","Utilities Select Sector SPDR","NYSE"],
  ["XLRE","Real Estate Select Sector SPDR","NYSE"],["XLB","Materials Select Sector SPDR","NYSE"],
  ["XLC","Communication Services Select SPDR","NYSE"],
  // Commodity / Gold
  ["GLD","SPDR Gold Shares","NYSE"],["IAU","iShares Gold Trust","NYSE"],
  ["SLV","iShares Silver Trust","NYSE"],["USO","United States Oil Fund","NYSE"],
  ["DBC","Invesco DB Commodity Index","NYSE"],["PDBC","Invesco Optimum Yield Diversified Commodity","NASDAQ"],
  ["GLDM","SPDR Gold MiniShares","NYSE"],["SGOL","Aberdeen Physical Gold Shares ETF","NYSE"],
  // Crypto ETFs
  ["IBIT","iShares Bitcoin Trust ETF","NASDAQ"],["FBTC","Fidelity Wise Origin Bitcoin Fund","NYSE"],
  ["ETHA","iShares Ethereum Trust ETF","NASDAQ"],["GBTC","Grayscale Bitcoin Trust","NYSE"],
  ["ETHE","Grayscale Ethereum Trust","NYSE"],["ARKB","ARK 21Shares Bitcoin ETF","NYSE"],
  ["BITB","Bitwise Bitcoin ETF","NYSE"],
  // Thematic
  ["ARKK","ARK Innovation ETF","NYSE"],["ARKW","ARK Next Generation Internet ETF","NYSE"],
  ["ARKF","ARK Fintech Innovation ETF","NYSE"],["ARKG","ARK Genomic Revolution ETF","NYSE"],
  ["SOXX","iShares Semiconductor ETF","NASDAQ"],["SMH","VanEck Semiconductor ETF","NASDAQ"],
  ["HACK","ETFMG Prime Cyber Security ETF","NYSE"],["BOTZ","Global X Robotics & AI ETF","NASDAQ"],
  ["ROBO","ROBO Global Robotics and Automation ETF","NYSE"],["LIT","Global X Lithium & Battery ETF","NYSE"],
  ["TAN","Invesco Solar ETF","NYSE"],["ICLN","iShares Global Clean Energy ETF","NASDAQ"],
  ["QCLN","First Trust NASDAQ Clean Edge Green Energy","NASDAQ"],
  ["PBW","Invesco WilderHill Clean Energy ETF","NYSE"],
  ["AIQ","Global X AI & Technology ETF","NASDAQ"],["IRBO","iShares Robotics and AI Multisector ETF","NYSE"],
  // REIT ETFs
  ["VNQ","Vanguard Real Estate ETF","NYSE"],["SCHH","Schwab US REIT ETF","NYSE"],
  ["IYR","iShares US Real Estate ETF","NYSE"],["RWR","SPDR DJ Wilshire REIT ETF","NYSE"],
  ["USRT","iShares Core US REIT ETF","NYSE"],["REET","iShares Global REIT ETF","NYSE"],
  // Leveraged / Inverse (popular)
  ["TQQQ","ProShares UltraPro QQQ","NASDAQ"],["SQQQ","ProShares UltraPro Short QQQ","NASDAQ"],
  ["SPXL","Direxion Daily S&P 500 Bull 3X","NYSE"],["SPXS","Direxion Daily S&P 500 Bear 3X","NYSE"],
  ["UPRO","ProShares UltraPro S&P500","NYSE"],["SH","ProShares Short S&P500","NYSE"],
  ["SSO","ProShares Ultra S&P500","NYSE"],["SOXL","Direxion Daily Semicond Bull 3X","NYSE"],
  ["SOXS","Direxion Daily Semicond Bear 3X","NYSE"],
];

// US REITs (classified as us_stock)
const US_REITS: [string, string, string][] = [
  ["O","Realty Income Corp","NYSE"],["AMT","American Tower Corp","NYSE"],
  ["PLD","Prologis Inc","NYSE"],["CCI","Crown Castle Intl","NYSE"],
  ["EQIX","Equinix Inc","NASDAQ"],["SPG","Simon Property Group","NYSE"],
  ["DLR","Digital Realty Trust","NYSE"],["PSA","Public Storage","NYSE"],
  ["WELL","Welltower Inc","NYSE"],["AVB","AvalonBay Communities","NYSE"],
  ["EQR","Equity Residential","NYSE"],["VTR","Ventas Inc","NYSE"],
  ["ARE","Alexandria Real Estate","NYSE"],["MAA","Mid-America Apartment","NYSE"],
  ["STAG","STAG Industrial","NYSE"],["NNN","NNN REIT Inc","NYSE"],
  ["VICI","VICI Properties","NYSE"],["IRM","Iron Mountain Inc","NYSE"],
  ["SBAC","SBA Communications","NASDAQ"],["WPC","W. P. Carey","NYSE"],
  ["GLPI","Gaming and Leisure Properties","NASDAQ"],["CUBE","CubeSmart","NYSE"],
  ["EXR","Extra Space Storage","NYSE"],["ESS","Essex Property Trust","NYSE"],
  ["UDR","UDR Inc","NYSE"],["CPT","Camden Property Trust","NYSE"],
  ["KIM","Kimco Realty","NYSE"],["REG","Regency Centers","NASDAQ"],
  ["FRT","Federal Realty Investment","NYSE"],["BXP","BXP Inc","NYSE"],
  ["SLG","SL Green Realty","NYSE"],["MPW","Medical Properties Trust","NYSE"],
  ["OHI","Omega Healthcare","NYSE"],["HR","Healthcare Realty Trust","NYSE"],
  ["DOC","Physicians Realty Trust","NYSE"],["HIW","Highwoods Properties","NYSE"],
  ["KRC","Kilroy Realty","NYSE"],["DEA","Easterly Government Properties","NYSE"],
  ["IIPR","Innovative Industrial Properties","NYSE"],["COLD","Americold Realty Trust","NYSE"],
  ["INVH","Invitation Homes","NYSE"],["SUI","Sun Communities","NYSE"],
  ["ELS","Equity LifeStyle Properties","NYSE"],["PEAK","Healthpeak Properties","NYSE"],
  ["HST","Host Hotels & Resorts","NASDAQ"],["RHP","Ryman Hospitality Properties","NYSE"],
  ["APLE","Apple Hospitality REIT","NYSE"],["SHO","Sunstone Hotel Investors","NYSE"],
  ["ADC","Agree Realty","NYSE"],["EPRT","Essential Properties Realty","NYSE"],
  ["STOR","STORE Capital","NYSE"],["BNL","Broadstone Net Lease","NYSE"],
];

export async function POST() {
  const supabase = getSupabase();

  const rows: AssetRow[] = [];

  for (const [ticker, name, exchange] of US_STOCKS) {
    rows.push({ ticker, name, asset_type: "us_stock", currency: "USD", exchange, is_active: true });
  }
  for (const [ticker, name, exchange] of US_ETFS) {
    rows.push({ ticker, name, asset_type: "us_etf", currency: "USD", exchange, is_active: true });
  }
  for (const [ticker, name, exchange] of US_REITS) {
    rows.push({ ticker, name, asset_type: "us_stock", currency: "USD", exchange, is_active: true });
  }

  // Deduplicate by ticker
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    if (seen.has(r.ticker)) return false;
    seen.add(r.ticker);
    return true;
  });

  try {
    // Upsert in batches of 100
    let totalInserted = 0;
    let totalSkipped = 0;
    const batchSize = 100;

    for (let i = 0; i < uniqueRows.length; i += batchSize) {
      const batch = uniqueRows.slice(i, i + batchSize);
      const { data: inserted, error } = await supabase
        .from("invest_assets")
        .upsert(batch, { onConflict: "ticker", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("Supabase upsert error:", error);
      }

      totalInserted += inserted?.length || 0;
      totalSkipped += batch.length - (inserted?.length || 0);
    }

    return NextResponse.json({
      success: true,
      totalInserted,
      totalSkipped,
      totalAssets: uniqueRows.length,
    });
  } catch (error) {
    console.error("Seed US error:", error);
    return NextResponse.json(
      { error: "Failed to seed US assets" },
      { status: 500 }
    );
  }
}
