const UNB_API_TOKEN=process.env.UNBELIEVABOAT_API_TOKEN;
const express=require("express");
const {Client,GatewayIntentBits,REST,Routes,SlashCommandBuilder,EmbedBuilder,PermissionFlagsBits,MessageFlags,ChannelType,ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder}=require("discord.js");
const {Pool}=require("pg");
const crypto=require("crypto");

const TOKEN=process.env.DISCORD_BOT_TOKEN,GUILD_ID=process.env.DISCORD_GUILD_ID,DATABASE_URL=process.env.DATABASE_URL,PORT=process.env.PORT||3000;
const UNB_IMPORT_MODE=String(process.env.UNB_IMPORT_MODE||"off").trim().toLowerCase();
if(!TOKEN||!GUILD_ID||!DATABASE_URL){console.error("Missing DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, or DATABASE_URL");process.exit(1);}
const db=new Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false}});
const app=express();app.get("/",(_,r)=>r.send("Reichsmark Economy Bot online"));app.listen(PORT,()=>console.log("Health listener:",PORT));
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const q=(t,p=[])=>db.query(t,p),rm=n=>`RM ${Number(n).toLocaleString("en-US")}`,now=()=>new Date();

const STOCK_MARKET_DASHBOARD_CHANNEL_ID="1555105620619956234";
const ECONOMIC_DASHBOARD_CHANNEL_ID="1557161642117177505";

const uiLine=s=>String(s??"");
const uiBlank=()=>"";
const uiRule=()=>"";
const uiPair=(label,value)=>`**${String(label??"")}:** ${String(value??"")}`;
const uiBox=(title,lines=[],footer="TA Reichsmark Economy")=>[
 `**${title}**`,...lines.filter(Boolean),footer?`*${footer}*`:""
].filter(Boolean).join("\n");
const uiCode=s=>String(s??"");
const shortTx=()=>String(Date.now()).slice(-5);

const COMMAND_TITLES={
 balance:"🏦 Reichsbank Account",account:"🏦 Financial Profile",pay:"💸 Reichsmark Transfer",
 daily:"🎁 Daily Reward",work:"💼 Employment",rob:"🚨 Robbery",deposit:"🏦 Bank Deposit",
 withdraw:"🏦 Bank Withdrawal",leaderboard:"🏆 Reichsmark Leaderboard",transactions:"📜 Transactions",
 salary:"💼 Salary",paycheck:"💵 Paycheck",treasury:"🏛️ Government Treasury",casino:"🎰 Reichsmark Casino",
 lottery:"🎟️ Reichsmark Lottery",shop:"🛒 Reichsmark Shop",buy:"🛍️ Purchase",inventory:"🎒 Inventory",use:"🎟️ Use Item",
 properties:"🏠 Property",stocks:"📈 Stock Exchange",portfolio:"📊 Portfolio",stock:"📈 Stock Trading",
 bet:"🎯 Community Betting",market:"📈 Financial Market",chart:"📉 Live Stock Chart",marketsetup:"⚙️ Market Setup",
 reichsbank:"🏦 Reichsbank",economyreport:"📊 National Economy",credit:"💳 Credit Profile",
 loan:"🏦 Lending",release:"🔓 Prisoner Release",business:"🏢 Business",career:"💼 Career",wealth:"💰 National Wealth",
 orders:"📑 Limit Orders",limitorder:"📈 Limit Order",finance:"🧾 Finance Administration",
 economyimport:"📥 Economy Import",economylog:"📋 Economy Audit Log",government:"🏛️ Government Economy",
 economy:"⚙️ Economy Administration"
};
function stripLegacyFormatting(v){
 return String(v??"")
  .replace(/^```(?:text)?\s*/i,"").replace(/```$/,"")
  .replace(/[]/g,"")
  .trim().slice(0,4000)||"Done.";
}
function commandResponseEmbed(commandName,text,user){
 return new EmbedBuilder()
  .setAuthor({name:user.username,iconURL:user.displayAvatarURL({size:128})})
  .setTitle(COMMAND_TITLES[commandName]||"💠 Reichsmark Economy")
  .setDescription(stripLegacyFormatting(text))
  .setFooter({text:"TA Reichsmark Economy"})
  .setTimestamp();
}
function forceCommandEmbed(commandName,payload,user){
 if(typeof payload==="string")return {embeds:[commandResponseEmbed(commandName,payload,user)]};
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return payload;
 if(payload.embeds?.length)return payload;
 if(typeof payload.content==="string"){
  const p={...payload,embeds:[commandResponseEmbed(commandName,payload.content,user)]};
  // Preserve raw content only when it is needed to actually ping a role/user.
  if(!/<@!?&?\d+>/.test(payload.content))delete p.content;
  return p;
 }
 return payload;
}

const CIVIL_WORK=[
 "Professional Pigeon Negotiator",
 "Royal Mail Sorter",
 "Traffic Cone Inspector",
 "Emergency Sandwich Consultant",
 "Public Works Technician",
 "Warehouse Forklift Operator",
 "Government Filing Specialist",
 "Majestic Post Courier",
 "Construction Crew Member",
 "Road Maintenance Worker",
 "Transit Station Attendant",
 "Hotel Front Desk Clerk",
 "Coffee Quality Inspector",
 "Office Supply Coordinator",
 "Museum Night Guard",
 "City Park Groundskeeper",
 "Furniture Assembly Technician",
 "Grocery Stock Clerk",
 "Restaurant Dishwasher",
 "Bakery Assistant",
 "Delivery Van Driver",
 "Taxi Dispatcher",
 "Train Platform Attendant",
 "Airport Baggage Handler",
 "Library Shelving Specialist",
 "Archive Records Clerk",
 "Court Filing Assistant",
 "Recycling Plant Worker",
 "Factory Line Operator",
 "Machine Shop Assistant",
 "Auto Repair Apprentice",
 "Car Wash Supervisor",
 "Window Cleaning Specialist",
 "Elevator Button Inspector",
 "Professional Line Waiter",
 "Lost Sock Investigator",
 "Vending Machine Technician",
 "Streetlight Maintenance Worker",
 "Bridge Paint Inspector",
 "Parking Meter Technician",
 "Bus Depot Cleaner",
 "Municipal Sign Installer",
 "Storm Drain Inspector",
 "Water Department Technician",
 "Power Grid Maintenance Worker",
 "Telephone Pole Inspector",
 "Internet Cable Technician",
 "Computer Repair Assistant",
 "Data Entry Specialist",
 "Office Receptionist",
 "Customer Service Representative",
 "Call Center Operator",
 "Retail Cashier",
 "Store Inventory Clerk",
 "Shopping Cart Collector",
 "Mall Security Guard",
 "Movie Theater Attendant",
 "Bowling Alley Technician",
 "Arcade Machine Repairer",
 "Theme Park Ride Attendant",
 "Zoo Gift Shop Clerk",
 "Aquarium Cleaner",
 "Pet Grooming Assistant",
 "Dog Walking Specialist",
 "Cat Café Attendant",
 "Horse Stable Worker",
 "Farm Equipment Operator",
 "Greenhouse Assistant",
 "Garden Center Clerk",
 "Tree Trimming Assistant",
 "Lawn Care Technician",
 "Pool Maintenance Worker",
 "Beach Cleanup Worker",
 "Marina Dockhand",
 "Fishing Supply Clerk",
 "Boat Cleaning Technician",
 "Hotel Housekeeper",
 "Laundry Room Attendant",
 "Kitchen Prep Cook",
 "Food Delivery Driver",
 "Pizza Box Folding Expert",
 "Professional Taste Tester",
 "Ice Cream Quality Inspector",
 "Pretzel Twisting Specialist",
 "Donut Glaze Technician",
 "Cereal Sorting Expert",
 "Snack Machine Refiller",
 "Beverage Distribution Worker",
 "Package Tracking Specialist",
 "Freight Loading Technician",
 "Shipping Label Inspector",
 "Moving Crew Member",
 "Storage Facility Attendant",
 "Building Maintenance Technician",
 "Janitorial Services Worker",
 "HVAC Assistant",
 "Plumbing Apprentice",
 "Electrical Apprentice",
 "Roofing Crew Assistant",
 "Painting Crew Member",
 "Concrete Mixing Technician",
 "Fence Installation Worker",
 "Sign Painting Assistant",
 "Printing Press Operator",
 "Newspaper Delivery Specialist",
 "Radio Station Assistant",
 "Studio Equipment Runner",
 "Event Setup Technician",
 "Concert Cleanup Crew Member",
 "Stadium Concessions Worker",
 "Scoreboard Operator",
 "Sports Equipment Manager",
 "Community Center Attendant",
 "School Cafeteria Worker",
 "Campus Maintenance Assistant",
 "Bookstore Clerk",
 "Copy Machine Whisperer",
 "Stapler Repair Specialist",
 "Professional Clipboard Carrier",
 "Official Hallway Monitor",
 "Department of Very Important Boxes Clerk",
 "Certified Door Hinge Inspector",
 "Government Chair Tester",
 "Professional Queue Coordinator",
 "Office Plant Watering Specialist",
 "Certified Rubber Stamp Operator",
 "Executive Coffee Runner",
 "Paperclip Inventory Auditor",
 "Professional Button Counter",
 "Municipal Pothole Observer"
];
const PRISON_WORK=[
 "Prison Laundry Worker",
 "Kitchen Detail Worker",
 "Cell Block Sanitation Worker",
 "Prison Library Assistant",
 "Maintenance Detail Worker",
 "Groundskeeping Detail Worker",
 "Supply Room Clerk",
 "Meal Tray Distribution Worker",
 "Uniform Laundry Sorter",
 "Facility Cleaning Worker",
 "Kitchen Prep Worker",
 "Dishwashing Detail Worker",
 "Recreation Area Cleanup Worker",
 "Prison Workshop Assistant",
 "Inventory Detail Worker",
 "Hallway Cleaning Worker",
 "Trash Collection Detail Worker",
 "Linen Distribution Worker",
 "Food Service Detail Worker",
 "Library Shelving Worker",
 "Facility Painting Detail Worker",
 "Grounds Maintenance Worker",
 "Storage Room Organizer",
 "Sanitation Detail Worker"
];
const pick=a=>a[crypto.randomInt(0,a.length)];

const POLICE_ROLE_ID="1427052648787345509";
const ROB_COOLDOWN=10*60*1000;
const ROB_SUCCESS=[
 "showed up in a fake mustache with a bag labeled NOT STOLEN MONEY. Somehow it worked.",
 "pretended to be conducting an extremely official wallet inspection and nobody questioned it.",
 "rolled up in a shopping cart, grabbed the RM, and vanished around a corner.",
 "used a clipboard, a reflective vest, and unreasonable confidence. The plan actually worked.",
 "announced a surprise wallet audit and walked away richer before anyone asked questions.",
 "hid behind a newspaper that was obviously upside down. Against all odds, the robbery succeeded.",
 "claimed to be from the Department of Extremely Important Money and somehow got paid.",
 "executed a getaway plan involving a bicycle bell and suspiciously dramatic sunglasses.",
 "walked in carrying an empty pizza box and walked out carrying considerably more RM.",
 "distracted everyone with an argument about taxes and quietly escaped with the wallet cash.",
 "used a cardboard badge reading DEFINITELY AUTHORIZED. It was apparently convincing.",
 "arrived in a trench coat, whispered business, and disappeared before anyone understood what happened.",
 "pulled off a heist powered entirely by confidence and terrible decision-making.",
 "asked for directions, caused complete confusion, and somehow left with the RM.",
 "deployed the legendary look-over-there strategy. Incredibly, it worked.",
 "staged a fake survey about wallet security and immediately demonstrated why the survey was necessary.",
 "carried a folder marked CLASSIFIED and nobody wanted to ask what was inside.",
 "performed the slowest getaway in history and still somehow escaped.",
 "used an aggressively professional handshake as a distraction and completed the heist.",
 "claimed the money was being recalled for quality control. The explanation worked.",
 "arrived with a traffic cone and somehow gained instant authority.",
 "pulled a receipt from nowhere and insisted the wallet had already been refunded.",
 "started counting backward from ten for no reason. Everyone panicked except the robber.",
 "used a fake radio, said package secured, and calmly walked away.",
 "turned a routine conversation into an unexpectedly successful RM extraction."
];
const ROB_FAIL=[
 "tried robbing an ATM with a library card and immediately attracted attention.",
 "forgot who the target was and attempted to rob their own reflection.",
 "announced THIS IS DEFINITELY NOT A ROBBERY before doing anything else.",
 "tripped over absolutely nothing and dropped the entire plan on the floor.",
 "wore a name tag with their actual username on it. Investigators appreciated the assistance.",
 "brought a getaway bicycle but forgot how bicycle locks work.",
 "attempted a dramatic escape through a door clearly marked PULL.",
 "used a fake mustache that fell off approximately two seconds into the operation.",
 "handed the victim a written robbery plan by mistake.",
 "tried the look-over-there trick while pointing directly at themselves.",
 "forgot the getaway vehicle was still parked with the hazard lights on.",
 "attempted to whisper the demand but accidentally shouted it.",
 "brought an empty duffel bag and somehow managed to lose that too.",
 "claimed to be conducting a wallet inspection but could not explain which department sent them.",
 "tried hiding behind a plant significantly smaller than they were.",
 "ran from the scene and immediately returned because they forgot their phone.",
 "attempted an intimidating entrance and walked into the wrong room.",
 "used a cardboard badge, but spelled AUTHORIZED wrong.",
 "started negotiating with the victim and somehow ended up owing a fine.",
 "tried to escape in an elevator that was out of service.",
 "attempted a disguise consisting only of different sunglasses.",
 "forgot the target could simply say no.",
 "set off a silent alarm while trying to turn off a desk lamp.",
 "attempted a getaway shortcut that led directly back to the scene.",
 "produced a suspiciously detailed confession while trying to explain what happened."
];
const ROB_JACKPOT=[
 "pulled off a once-in-a-generation heist that made absolutely no sense but somehow worked.",
 "executed a ridiculous multi-stage plan involving a clipboard, three decoys, and perfect timing.",
 "somehow turned total chaos into the heist of the century."
];


const START=50,DAILY=250,WORK_MIN=100,WORK_MAX=350;
const PRISON_WORK_MIN=10,PRISON_WORK_MAX=35;

async function init(){
 await q(`CREATE TABLE IF NOT EXISTS economy_accounts(guild_id TEXT,user_id TEXT,wallet BIGINT NOT NULL DEFAULT 50,bank BIGINT NOT NULL DEFAULT 0,last_daily TIMESTAMPTZ,last_work TIMESTAMPTZ,last_paycheck TIMESTAMPTZ,starter_grant_claimed BOOLEAN DEFAULT TRUE,created_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(guild_id,user_id))`);
 await q(`ALTER TABLE economy_accounts ADD COLUMN IF NOT EXISTS last_paycheck TIMESTAMPTZ`);
 await q(`ALTER TABLE economy_accounts ADD COLUMN IF NOT EXISTS last_rob TIMESTAMPTZ`);
 await q(`CREATE TABLE IF NOT EXISTS economy_interaction_claims(
  interaction_id TEXT PRIMARY KEY,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`DELETE FROM economy_interaction_claims WHERE claimed_at < NOW() - INTERVAL '2 days'`);
 await q(`ALTER TABLE economy_accounts ADD COLUMN IF NOT EXISTS starter_grant_claimed BOOLEAN DEFAULT TRUE`);
 await q(`CREATE TABLE IF NOT EXISTS economy_transactions(id BIGSERIAL PRIMARY KEY,guild_id TEXT NOT NULL,from_user_id TEXT,to_user_id TEXT,amount BIGINT NOT NULL,type TEXT NOT NULL,note TEXT DEFAULT '',created_at TIMESTAMPTZ DEFAULT NOW())`);
 await q(`CREATE TABLE IF NOT EXISTS economy_treasury(guild_id TEXT PRIMARY KEY,balance BIGINT DEFAULT 0,tax_revenue BIGINT DEFAULT 0,expenses BIGINT DEFAULT 0)`);
 await q(`CREATE TABLE IF NOT EXISTS economy_settings(guild_id TEXT PRIMARY KEY,payroll_hours INT DEFAULT 24,income_tax NUMERIC(5,2) DEFAULT 10,property_tax NUMERIC(5,2) DEFAULT 5,large_property_tax NUMERIC(5,2) DEFAULT 10,property_category_id TEXT)`);
 await q(`CREATE TABLE IF NOT EXISTS economy_runtime_state(guild_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT,updated_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(guild_id,key))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_announcement_links(
   guild_id TEXT PRIMARY KEY,announcement_channel_id TEXT NOT NULL,enabled BOOLEAN DEFAULT TRUE,updated_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_announcement_events(
   guild_id TEXT NOT NULL,message_id TEXT NOT NULL,event_type TEXT NOT NULL,summary TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),
   PRIMARY KEY(guild_id,message_id)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_salary_roles(guild_id TEXT,role_id TEXT,role_name TEXT,category TEXT,amount BIGINT,PRIMARY KEY(guild_id,role_id))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_inventory(guild_id TEXT,user_id TEXT,item_id BIGINT,quantity INT DEFAULT 1,PRIMARY KEY(guild_id,user_id,item_id))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_shop(id BIGSERIAL PRIMARY KEY,guild_id TEXT,name TEXT,description TEXT,price BIGINT,stock INT DEFAULT -1,item_type TEXT DEFAULT 'item',channel_prefix TEXT,active BOOLEAN DEFAULT TRUE)`);
 await q(`CREATE TABLE IF NOT EXISTS economy_properties(id BIGSERIAL PRIMARY KEY,guild_id TEXT,user_id TEXT,item_id BIGINT,name TEXT,channel_id TEXT,purchased_at TIMESTAMPTZ DEFAULT NOW())`);
 await q(`CREATE TABLE IF NOT EXISTS economy_lottery(guild_id TEXT PRIMARY KEY,jackpot BIGINT DEFAULT 500,ticket_price BIGINT DEFAULT 50,status TEXT DEFAULT 'open',draw_at TIMESTAMPTZ)`);
 await q(`CREATE TABLE IF NOT EXISTS economy_lottery_tickets(guild_id TEXT,user_id TEXT,tickets INT DEFAULT 0,PRIMARY KEY(guild_id,user_id))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_stocks(id BIGSERIAL PRIMARY KEY,guild_id TEXT,symbol TEXT,name TEXT,price NUMERIC(18,2),supply BIGINT,active BOOLEAN DEFAULT TRUE,last_update TIMESTAMPTZ DEFAULT NOW(),UNIQUE(guild_id,symbol))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_stock_holdings(guild_id TEXT,user_id TEXT,stock_id BIGINT,shares BIGINT DEFAULT 0,PRIMARY KEY(guild_id,user_id,stock_id))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_stock_history(id BIGSERIAL PRIMARY KEY,stock_id BIGINT,price NUMERIC(18,2),created_at TIMESTAMPTZ DEFAULT NOW())`);
 await q(`CREATE TABLE IF NOT EXISTS economy_stock_trade_offers(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT NOT NULL,seller_id TEXT NOT NULL,buyer_id TEXT NOT NULL,
   stock_id BIGINT NOT NULL,shares BIGINT NOT NULL,price_per_share NUMERIC(18,2) NOT NULL,
   status TEXT DEFAULT 'open',message_id TEXT,channel_id TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW(),expires_at TIMESTAMPTZ DEFAULT (NOW()+INTERVAL '15 minutes'),
   completed_at TIMESTAMPTZ
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_live_stock_charts(
   guild_id TEXT NOT NULL,symbol TEXT NOT NULL,channel_id TEXT NOT NULL,message_id TEXT NOT NULL,
   last_sync TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(guild_id,symbol)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_index_history(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT NOT NULL,index_symbol TEXT NOT NULL,
   value NUMERIC(18,4) NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE INDEX IF NOT EXISTS economy_index_history_lookup ON economy_index_history(guild_id,index_symbol,created_at DESC)`);
 await q(`CREATE TABLE IF NOT EXISTS economy_live_index_charts(
   guild_id TEXT NOT NULL,index_symbol TEXT NOT NULL,channel_id TEXT NOT NULL,message_id TEXT NOT NULL,
   last_sync TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(guild_id,index_symbol)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_bets(id BIGSERIAL PRIMARY KEY,guild_id TEXT,creator_id TEXT,title TEXT,option_a TEXT,option_b TEXT,status TEXT DEFAULT 'open',winner TEXT,created_at TIMESTAMPTZ DEFAULT NOW())`);
 await q(`CREATE TABLE IF NOT EXISTS economy_bet_entries(bet_id BIGINT,user_id TEXT,choice TEXT,amount BIGINT,PRIMARY KEY(bet_id,user_id))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_government(guild_id TEXT PRIMARY KEY,debt BIGINT DEFAULT 0,debt_limit BIGINT DEFAULT 10000000,reserve_balance BIGINT DEFAULT 0,budget_name TEXT DEFAULT 'General Budget',budget_spending_limit BIGINT DEFAULT 0,interest_rate NUMERIC(6,2) DEFAULT 2.00,last_interest TIMESTAMPTZ DEFAULT NOW())`);
 await q(`CREATE TABLE IF NOT EXISTS economy_government_ledger(id BIGSERIAL PRIMARY KEY,guild_id TEXT,kind TEXT,category TEXT,amount BIGINT,note TEXT,actor_id TEXT,created_at TIMESTAMPTZ DEFAULT NOW())`);
 await q(`CREATE TABLE IF NOT EXISTS economy_live_dashboard(guild_id TEXT PRIMARY KEY,channel_id TEXT,message_id TEXT,last_sync TIMESTAMPTZ DEFAULT NOW())`);
 await q(`ALTER TABLE economy_shop ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General'`);
 await q(`ALTER TABLE economy_shop ADD COLUMN IF NOT EXISTS base_price BIGINT`);
 await q(`UPDATE economy_shop SET base_price=price WHERE base_price IS NULL OR base_price<=0`);
 await q(`CREATE TABLE IF NOT EXISTS economy_fiscal_policy(
   guild_id TEXT PRIMARY KEY,auto_mode BOOLEAN DEFAULT TRUE,cpi NUMERIC(12,4) DEFAULT 100.0000,
   sales_tax NUMERIC(6,2) DEFAULT 4.00,business_tax NUMERIC(6,2) DEFAULT 8.00,
   target_inflation NUMERIC(6,2) DEFAULT 2.00,last_auto_date TEXT,
   last_reason TEXT DEFAULT 'Interim automatic fiscal policy',updated_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_budget_allocations(
   guild_id TEXT,category TEXT,percent NUMERIC(6,2),priority INT DEFAULT 50,active BOOLEAN DEFAULT TRUE,
   PRIMARY KEY(guild_id,category)
 )`);
 await q(`INSERT INTO economy_fiscal_policy(guild_id) VALUES($1) ON CONFLICT DO NOTHING`,[GUILD_ID]);
 const interimBudget=[['Public Administration',20,90],['Security & Justice',20,90],['Infrastructure',20,80],['Economic Development',15,70],['Social Services',10,60],['Debt Service',10,85],['Emergency Reserve',5,100]];
 for(const [cat,pct,priority] of interimBudget)await q(`INSERT INTO economy_budget_allocations(guild_id,category,percent,priority) VALUES($1,$2,$3,$4) ON CONFLICT(guild_id,category) DO NOTHING`,[GUILD_ID,cat,pct,priority]);
 await q(`ALTER TABLE economy_stocks ADD COLUMN IF NOT EXISTS available_supply BIGINT`);
 await q(`ALTER TABLE economy_stocks ADD COLUMN IF NOT EXISTS volatility NUMERIC(8,5) DEFAULT 0.02000`);
 await q(`ALTER TABLE economy_stocks ADD COLUMN IF NOT EXISTS volume_24h BIGINT DEFAULT 0`);
 await q(`UPDATE economy_stocks SET available_supply=supply WHERE available_supply IS NULL`);
 await q(`ALTER TABLE economy_stock_holdings ADD COLUMN IF NOT EXISTS avg_cost NUMERIC(18,4) DEFAULT 0`);
 await q(`CREATE TABLE IF NOT EXISTS economy_market_events(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT,stock_id BIGINT,title TEXT,description TEXT,
   impact_pct NUMERIC(8,4) DEFAULT 0,expires_at TIMESTAMPTZ,active BOOLEAN DEFAULT TRUE,
   created_by TEXT,created_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_gdp_snapshots (
   guild_id TEXT NOT NULL,
   hour_bucket TIMESTAMPTZ NOT NULL,
   estimated_output NUMERIC(20,2) NOT NULL,
   transaction_flow_24h NUMERIC(20,2) NOT NULL,
   transaction_count_24h BIGINT NOT NULL,
   money_supply NUMERIC(20,2) NOT NULL,
   treasury NUMERIC(20,2) NOT NULL,
   market_cap NUMERIC(20,2) NOT NULL,
   property_value NUMERIC(20,2) NOT NULL,
   account_count BIGINT NOT NULL,
   recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   PRIMARY KEY(guild_id,hour_bucket)
 )`);
 await q(`CREATE INDEX IF NOT EXISTS economy_gdp_snapshots_recent ON economy_gdp_snapshots(guild_id,hour_bucket DESC)`);
 await q(`CREATE TABLE IF NOT EXISTS economy_macro_history(
   guild_id TEXT,record_date TEXT,gdp NUMERIC(18,2),money_supply NUMERIC(18,2),
   inflation NUMERIC(8,3),activity NUMERIC(8,3),treasury NUMERIC(18,2),
   stock_index NUMERIC(18,2),created_at TIMESTAMPTZ DEFAULT NOW(),
   PRIMARY KEY(guild_id,record_date)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_savings(
   guild_id TEXT,user_id TEXT,balance BIGINT DEFAULT 0,last_interest_at TIMESTAMPTZ DEFAULT NOW(),
   PRIMARY KEY(guild_id,user_id)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_unb_imports(
   guild_id TEXT NOT NULL,user_id TEXT NOT NULL,old_cash BIGINT DEFAULT 0,old_bank BIGINT DEFAULT 0,
   imported_cash BIGINT DEFAULT 0,imported_bank BIGINT DEFAULT 0,imported_at TIMESTAMPTZ DEFAULT NOW(),
   PRIMARY KEY(guild_id,user_id)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_log_settings(
   guild_id TEXT PRIMARY KEY,channel_id TEXT,enabled BOOLEAN DEFAULT TRUE,updated_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_citizenship(
   guild_id TEXT,user_id TEXT,citizen BOOLEAN DEFAULT FALSE,obtained_at TIMESTAMPTZ,
   source TEXT,PRIMARY KEY(guild_id,user_id)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_prison_status(
   guild_id TEXT,user_id TEXT,active BOOLEAN DEFAULT FALSE,marked_at TIMESTAMPTZ DEFAULT NOW(),
   released_at TIMESTAMPTZ,source TEXT,PRIMARY KEY(guild_id,user_id)
 )`);
  await q(`CREATE TABLE IF NOT EXISTS economy_prison_role_backup(guild_id TEXT NOT NULL,user_id TEXT NOT NULL,role_ids TEXT[] NOT NULL DEFAULT '{}',saved_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(guild_id,user_id))`);
 await q(`CREATE TABLE IF NOT EXISTS economy_credit(
   guild_id TEXT,user_id TEXT,score INT DEFAULT 650,on_time_payments INT DEFAULT 0,
   late_payments INT DEFAULT 0,total_borrowed BIGINT DEFAULT 0,total_repaid BIGINT DEFAULT 0,
   opened_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(guild_id,user_id)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_loans(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT,user_id TEXT,principal BIGINT,balance BIGINT,
   interest_rate NUMERIC(8,3),payment_amount BIGINT,next_payment TIMESTAMPTZ,
   term_days INT,status TEXT DEFAULT 'active',late_count INT DEFAULT 0,
   created_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_businesses(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT,owner_id TEXT,name TEXT UNIQUE,business_type TEXT,
   balance BIGINT DEFAULT 0,revenue BIGINT DEFAULT 0,expenses BIGINT DEFAULT 0,
   valuation BIGINT DEFAULT 5000,employees INT DEFAULT 0,level INT DEFAULT 1,
   channel_id TEXT,created_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_business_employees(
   business_id BIGINT,user_id TEXT,wage BIGINT DEFAULT 100,joined_at TIMESTAMPTZ DEFAULT NOW(),
   PRIMARY KEY(business_id,user_id)
 )`);
 await q(`ALTER TABLE economy_properties ADD COLUMN IF NOT EXISTS channel_id TEXT`);
 await q(`ALTER TABLE economy_properties ADD COLUMN IF NOT EXISTS purchase_price BIGINT DEFAULT 0`);
 await q(`ALTER TABLE economy_properties ADD COLUMN IF NOT EXISTS market_value BIGINT DEFAULT 0`);
 await q(`ALTER TABLE economy_properties ADD COLUMN IF NOT EXISTS rent_income BIGINT DEFAULT 0`);
 await q(`ALTER TABLE economy_properties ADD COLUMN IF NOT EXISTS mortgage_balance BIGINT DEFAULT 0`);
 await q(`ALTER TABLE economy_properties ADD COLUMN IF NOT EXISTS last_property_tick TIMESTAMPTZ DEFAULT NOW()`);
 await q(`UPDATE economy_properties p SET purchase_price=COALESCE(NULLIF(p.purchase_price,0),s.price,0),market_value=COALESCE(NULLIF(p.market_value,0),s.price,0) FROM economy_shop s WHERE p.item_id=s.id AND (COALESCE(p.purchase_price,0)=0 OR COALESCE(p.market_value,0)=0)`);

 await q(`CREATE TABLE IF NOT EXISTS economy_careers(
   guild_id TEXT,user_id TEXT,career TEXT DEFAULT 'Citizen',level INT DEFAULT 1,xp INT DEFAULT 0,
   total_earned BIGINT DEFAULT 0,last_shift TIMESTAMPTZ,PRIMARY KEY(guild_id,user_id)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_limit_orders(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT,user_id TEXT,stock_id BIGINT,side TEXT,
   shares BIGINT,remaining BIGINT,limit_price NUMERIC(18,2),status TEXT DEFAULT 'open',
   created_at TIMESTAMPTZ DEFAULT NOW(),filled_at TIMESTAMPTZ
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_dividends(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT,stock_id BIGINT,amount_per_share NUMERIC(18,2),
   total_paid BIGINT DEFAULT 0,paid_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_economic_events(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT,title TEXT,description TEXT,event_type TEXT,
   activity_impact NUMERIC(8,3) DEFAULT 0,inflation_impact NUMERIC(8,3) DEFAULT 0,
   property_impact NUMERIC(8,3) DEFAULT 0,business_impact NUMERIC(8,3) DEFAULT 0,
   expires_at TIMESTAMPTZ,active BOOLEAN DEFAULT TRUE,created_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_finance_audit(
   id BIGSERIAL PRIMARY KEY,guild_id TEXT,actor_id TEXT,action TEXT,amount BIGINT DEFAULT 0,
   details TEXT,created_at TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_market_settings(
   guild_id TEXT PRIMARY KEY,
   market_channel_id TEXT,
   news_channel_id TEXT,
   trading_channel_id TEXT,
   timezone TEXT DEFAULT 'America/New_York',
   open_hour INT DEFAULT 9,
   close_hour INT DEFAULT 16,
   last_session_date TEXT,
   last_bell_type TEXT
 )`);
 await q(`ALTER TABLE economy_market_settings ADD COLUMN IF NOT EXISTS next_auto_event_at TIMESTAMPTZ`);
 await q(`CREATE TABLE IF NOT EXISTS economy_market_dashboard(
   guild_id TEXT PRIMARY KEY,channel_id TEXT,message_id TEXT,last_sync TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_economic_dashboard(
   guild_id TEXT PRIMARY KEY,channel_id TEXT,message_id TEXT,last_sync TIMESTAMPTZ DEFAULT NOW()
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_market_sessions(
   guild_id TEXT,session_date TEXT,
   taia_open NUMERIC(18,2),taia_high NUMERIC(18,2),taia_low NUMERIC(18,2),taia_close NUMERIC(18,2),
   tac_open NUMERIC(18,2),tac_high NUMERIC(18,2),tac_low NUMERIC(18,2),tac_close NUMERIC(18,2),
   tabi_open NUMERIC(18,2),tabi_high NUMERIC(18,2),tabi_low NUMERIC(18,2),tabi_close NUMERIC(18,2),
   volume BIGINT DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(guild_id,session_date)
 )`);
 await q(`CREATE TABLE IF NOT EXISTS economy_market_daily_stock(
   guild_id TEXT,session_date TEXT,stock_id BIGINT,
   open NUMERIC(18,2),high NUMERIC(18,2),low NUMERIC(18,2),close NUMERIC(18,2),
   volume BIGINT DEFAULT 0,PRIMARY KEY(guild_id,session_date,stock_id)
 )`);
 await q(`INSERT INTO economy_market_settings(guild_id) VALUES($1) ON CONFLICT DO NOTHING`,[GUILD_ID]);
 await q(`INSERT INTO economy_government(guild_id) VALUES($1) ON CONFLICT DO NOTHING`,[GUILD_ID]);
 await q(`INSERT INTO economy_treasury(guild_id) VALUES($1) ON CONFLICT DO NOTHING`,[GUILD_ID]);

 // One-time interim government capitalization. It never refills after later spending.
 const INTERIM_STARTING_TREASURY=5000000;
 const treasurySeedKey='interim_treasury_capitalized_v1';
 const treasurySeed=(await q(`SELECT value FROM economy_runtime_state WHERE guild_id=$1 AND key=$2`,[GUILD_ID,treasurySeedKey])).rows[0];
 if(!treasurySeed){
  const currentTreasury=(await q(`SELECT balance FROM economy_treasury WHERE guild_id=$1`,[GUILD_ID])).rows[0]||{balance:0};
  const currentBalance=Math.max(0,Number(currentTreasury.balance||0));
  const capitalization=Math.max(0,INTERIM_STARTING_TREASURY-currentBalance);
  if(capitalization>0){
   await q(`UPDATE economy_treasury SET balance=balance+$2 WHERE guild_id=$1`,[GUILD_ID,capitalization]);
   await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id)
            VALUES($1,'capitalization','Interim Government Capitalization',$2,$3,'SYSTEM')`,
            [GUILD_ID,capitalization,`One-time capitalization to establish the interim treasury at ${INTERIM_STARTING_TREASURY} RM`]);
  }
  await q(`UPDATE economy_government
           SET budget_name='Interim National Budget',budget_spending_limit=$2,reserve_balance=500000
           WHERE guild_id=$1`,[GUILD_ID,INTERIM_STARTING_TREASURY]);
  await q(`INSERT INTO economy_runtime_state(guild_id,key,value)
           VALUES($1,$2,$3)
           ON CONFLICT(guild_id,key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
           [GUILD_ID,treasurySeedKey,JSON.stringify({startingTreasury:INTERIM_STARTING_TREASURY,capitalization})]);
  console.log(`[FISCAL] Interim treasury capitalized once to ${INTERIM_STARTING_TREASURY.toLocaleString()} RM.`);
 }

 await q(`INSERT INTO economy_settings(guild_id) VALUES($1) ON CONFLICT DO NOTHING`,[GUILD_ID]);
 await q(`INSERT INTO economy_lottery(guild_id,draw_at) VALUES($1,NOW()+INTERVAL '7 days') ON CONFLICT DO NOTHING`,[GUILD_ID]);
}

async function seedMarketAndShop(g){
 const stocks=[
  ["RBT","Reichsbahn Transport",42,12000,0.018],
  ["AEG","Authority Energy Group",68,9000,0.024],
  ["NWI","Norwitz Industries",31,15000,0.032],
  ["RBH","Reichsbank Holdings",95,7000,0.012],
  ["ATC","Authority Telecommunications",54,10000,0.021],
  ["IMF","Imperial Manufacturing",37,14000,0.029],
  ["NPG","National Property Group",76,8000,0.017],
  ["RTK","ReichsTech",115,6000,0.040]
 ];
 for(const [symbol,name,price,supply,volatility] of stocks){
  const r=await q(`INSERT INTO economy_stocks(guild_id,symbol,name,price,supply,available_supply,volatility)
    VALUES($1,$2,$3,$4,$5,$5,$6) ON CONFLICT(guild_id,symbol) DO NOTHING RETURNING id`,[g,symbol,name,price,supply,volatility]);
  if(r.rowCount)await q(`INSERT INTO economy_stock_history(stock_id,price) VALUES($1,$2)`,[r.rows[0].id,price]);
 }
 const items=[
  ["Coffee & Meal Voucher","Everyday Goods","A basic food and drink voucher.",35,50,"item"],
  ["Transit Pass","Everyday Goods","TA public transport pass.",75,40,"item"],
  ["Gaming Console","Entertainment","A premium entertainment system.",650,12,"item"],
  ["Collector Medal","Collectibles","Limited Reichsmark economy commemorative medal.",900,15,"item"],
  ["Luxury Watch","Luxury Goods","High-end personal luxury item.",1800,8,"item"],
  ["Compact Car","Vehicles","Entry-level personal vehicle.",6500,6,"item"],
  ["Executive Sedan","Vehicles","Premium executive vehicle.",12000,4,"item"],
  ["Business License","Licenses & Services","License used to represent a registered private enterprise.",3500,20,"item"],
  ["Small Residential Lot","Land","Private land holding with its own Discord property channel.",8500,8,"land"],
  ["Commercial Lot","Land","Commercial land holding with a private property channel.",18000,5,"land"],
  ["Apartment","Housing","Private apartment property with its own Discord channel.",12000,8,"house"],
  ["Townhouse","Housing","Private townhouse property with its own Discord channel.",22000,5,"house"],
  ["Estate","Housing","Large prestige residence with its own Discord channel.",55000,2,"house"],
  ["Small Business","Businesses","Starter enterprise with its own private business channel.",15000,8,"business"],
  ["Established Company","Businesses","Larger private enterprise with its own business channel.",35000,4,"business"],
  ["Major Corporation","Businesses","Top-tier corporate asset with its own business channel.",80000,2,"business"],
  ["Grocery Basket","Everyday Goods","One week of essential groceries.",120,80,"item"],
  ["Restaurant Dinner","Everyday Goods","A dinner at a local restaurant.",95,60,"item"],
  ["Winter Clothing","Everyday Goods","Practical seasonal clothing.",280,40,"item"],
  ["Mobile Phone","Electronics","A modern smartphone.",950,25,"item"],
  ["Laptop Computer","Electronics","Portable personal computer.",1750,18,"item"],
  ["Desktop Workstation","Electronics","Home and office computer.",2500,12,"item"],
  ["Home Furniture Set","Household","Furniture for a new home.",1800,20,"item"],
  ["Appliance Package","Household","Kitchen and laundry appliances.",3200,12,"item"],
  ["Bicycle","Vehicles","A reliable bicycle for commuting.",480,35,"item"],
  ["Motorcycle","Vehicles","Mid-range road motorcycle.",4200,10,"item"],
  ["Pickup Truck","Vehicles","Utility pickup truck.",18500,5,"item"],
  ["Luxury SUV","Vehicles","High-end sport utility vehicle.",32000,3,"item"],
  ["Delivery Van","Commercial Vehicles","Commercial delivery vehicle.",14000,8,"item"],
  ["Cargo Truck","Commercial Vehicles","Heavy commercial truck.",48000,3,"item"],
  ["Business Registration Filing","Licenses & Services","Formal business registration paperwork.",850,30,"item"],
  ["Building Permit","Licenses & Services","Permit for a construction project.",1200,25,"item"],
  ["Vendor Permit","Licenses & Services","Permit for market trading.",450,50,"item"],
  ["Trade Certificate","Education","Professional vocational qualification.",1100,30,"item"],
  ["University Tuition Voucher","Education","One academic tuition contribution.",5500,12,"item"],
  ["Office Suite","Commercial Property","Professional office premises.",28000,5,"house"],
  ["Retail Shopfront","Commercial Property","Street-facing commercial premises.",26000,6,"house"],
  ["Warehouse","Commercial Property","Commercial storage and logistics property.",45000,4,"house"],
  ["Suburban House","Housing","Detached residential property.",36000,6,"house"],
  ["Country Farm","Land","Agricultural landholding.",42000,5,"land"],
  ["Industrial Plot","Land","Industrial development land.",55000,3,"land"],
  ["Transport Company","Businesses","Registered logistics company.",42000,4,"business"],
  ["Manufacturing Workshop","Businesses","Small industrial manufacturing company.",26000,5,"business"],
  ["Retail Enterprise","Businesses","Retail business with a private channel.",21000,6,"business"],
  ["Technology Startup","Businesses","New technology venture.",30000,5,"business"],
  ["Hotel Enterprise","Businesses","Hospitality business with a private channel.",65000,3,"business"]
 ];
 for(const [name,category,description,price,stock,type] of items)
  await q(`INSERT INTO economy_shop(guild_id,name,category,description,price,stock,item_type)
   SELECT $1,$2,$3,$4,$5,$6,$7 WHERE NOT EXISTS(SELECT 1 FROM economy_shop WHERE guild_id=$1 AND name=$2)`,
   [g,name,category,description,price,stock,type]);
 await q(`INSERT INTO economy_shop(guild_id,name,price,stock,item_type,category,active)
 SELECT $1,'Citizenship',2500,999999,'citizenship','Civic Services',TRUE
 WHERE NOT EXISTS(SELECT 1 FROM economy_shop WHERE guild_id=$1 AND LOWER(name)='citizenship')`,[g]);
}

async function unbBalance(guildId,userId){
 if(!UNB_API_TOKEN)throw new Error("UNBELIEVABOAT_API_TOKEN is not configured.");
 const res=await fetch(`https://unbelievaboat.com/api/v1/guilds/${guildId}/users/${userId}`,{
  headers:{Authorization:UNB_API_TOKEN,"User-Agent":"TA-Reichsmark-Economy/1.0"}
 });
 if(res.status===429){
  const body=await res.json().catch(()=>({}));
  const wait=Math.max(1000,Number(body.retry_after)||1500);
  await new Promise(r=>setTimeout(r,wait));
  return unbBalance(guildId,userId);
 }
 if(res.status===404)return {cash:0,bank:0,total:0,notFound:true};
 if(!res.ok)throw new Error(`UnbelievaBoat API ${res.status}: ${(await res.text()).slice(0,180)}`);
 const b=await res.json();
 return {cash:Number(b.cash)||0,bank:Number(b.bank)||0,total:Number(b.total)||0};
}
async function getCurrentImportMembers(guild){
 console.log("[UNB IMPORT] Fetching current TA members from Discord...");
 const fetched=await guild.members.fetch();
 const members=[...fetched.values()].filter(m=>!m.user.bot);
 console.log(`[UNB IMPORT] Current non-bot members fetched: ${members.length}`);
 return members;
}

async function unbImportPreview(guild){
 const members=await getCurrentImportMembers(guild);
 const importedIds=new Set((await q(`SELECT user_id FROM economy_unb_imports WHERE guild_id=$1`,[guild.id])).rows.map(r=>r.user_id));
 let matched=0,zero=0,already=0,errors=0,total=0,checked=0;
 for(const m of members){
  if(importedIds.has(m.id)){already++;continue;}
  try{
   const b=await unbBalance(guild.id,m.id);
   const legacyTotal=(Number(b.cash)||0)+(Number(b.bank)||0);
   if(legacyTotal>0){matched++;total+=legacyTotal;}else zero++;
  }catch(e){console.error("[UNB PREVIEW]",m.id,e.message);errors++;}
  checked++;
  if(checked%25===0)console.log(`[UNB IMPORT] Preview progress: ${checked}/${members.length}`);
  await new Promise(r=>setTimeout(r,125));
 }
 return {current:members.length,matched,zero,already,errors,total};
}

async function importOneLegacyBalance(guildId,userId,b,actorId){
 const cash=Math.max(0,Math.trunc(Number(b.cash)||0));
 const bank=Math.max(0,Math.trunc(Number(b.bank)||0));
 const total=cash+bank;
 if(total<=0)return {status:"zero",total:0};

 const c=await db.connect();
 try{
  await c.query("BEGIN");
  const claim=await c.query(
   `INSERT INTO economy_unb_imports(guild_id,user_id,old_cash,old_bank,imported_cash,imported_bank)
    VALUES($1,$2,$3,$4,$3,$4)
    ON CONFLICT(guild_id,user_id) DO NOTHING
    RETURNING user_id`,
   [guildId,userId,cash,bank]
  );
  if(!claim.rowCount){await c.query("ROLLBACK");return {status:"already",total:0};}

  await c.query(
   `INSERT INTO economy_accounts(guild_id,user_id,wallet,bank,starter_grant_claimed)
    VALUES($1,$2,$3,$4,TRUE)
    ON CONFLICT(guild_id,user_id)
    DO UPDATE SET wallet=economy_accounts.wallet+$3,bank=economy_accounts.bank+$4`,
   [guildId,userId,cash,bank]
  );
  await c.query(
   `INSERT INTO economy_transactions(guild_id,from_user_id,to_user_id,amount,type,note)
    VALUES($1,NULL,$2,$3,'unbelievaboat_import',$4)`,
   [guildId,userId,total,`Legacy migration: cash ${rm(cash)}, bank ${rm(bank)}; initiated by ${actorId}`]
  );
  await c.query("COMMIT");
  return {status:"imported",total};
 }catch(e){
  await c.query("ROLLBACK").catch(()=>{});
  throw e;
 }finally{c.release();}
}

async function unbImportExecute(guild,actorId="startup"){
 const members=await getCurrentImportMembers(guild);
 const importedIds=new Set((await q(`SELECT user_id FROM economy_unb_imports WHERE guild_id=$1`,[guild.id])).rows.map(r=>r.user_id));
 let imported=0,skipped=0,errors=0,total=0,checked=0;
 for(const m of members){
  if(importedIds.has(m.id)){skipped++;continue;}
  try{
   const b=await unbBalance(guild.id,m.id);
   const result=await importOneLegacyBalance(guild.id,m.id,b,actorId);
   if(result.status==="imported"){imported++;total+=result.total;}
   else skipped++;
  }catch(e){console.error("[UNB EXECUTE]",m.id,e.message);errors++;}
  checked++;
  if(checked%25===0)console.log(`[UNB IMPORT] Execute progress: ${checked}/${members.length}`);
  await new Promise(r=>setTimeout(r,125));
 }
 return {current:members.length,imported,skipped,errors,total};
}

async function runStartupUnbImport(guild){
 if(!["preview","execute"].includes(UNB_IMPORT_MODE))return;
 if(!UNB_API_TOKEN){console.error("[UNB IMPORT] UNBELIEVABOAT_API_TOKEN is missing.");return;}
 console.log(`========== UNBELIEVABOAT STARTUP ${UNB_IMPORT_MODE.toUpperCase()} ==========`);
 try{
  if(UNB_IMPORT_MODE==="preview"){
   const r=await unbImportPreview(guild);
   console.log("[UNB IMPORT PREVIEW RESULT]",r);
   console.log(`[UNB IMPORT] Current non-bot members: ${r.current}`);
   console.log(`[UNB IMPORT] Members with legacy RM: ${r.matched}`);
   console.log(`[UNB IMPORT] Zero/no legacy balance: ${r.zero}`);
   console.log(`[UNB IMPORT] Already imported: ${r.already}`);
   console.log(`[UNB IMPORT] API errors: ${r.errors}`);
   console.log(`[UNB IMPORT] Legacy RM waiting: ${rm(r.total)}`);
   console.log("[UNB IMPORT] PREVIEW ONLY — no balances changed.");
  }else{
   const r=await unbImportExecute(guild,"startup-import");
   console.log("[UNB IMPORT EXECUTE RESULT]",r);
   console.log(`[UNB IMPORT] Imported members: ${r.imported}`);
   console.log(`[UNB IMPORT] Imported total: ${rm(r.total)}`);
   console.log(`[UNB IMPORT] Skipped/already imported/no balance: ${r.skipped}`);
   console.log(`[UNB IMPORT] Errors: ${r.errors}`);
   console.log("[UNB IMPORT] Set UNB_IMPORT_MODE=off after a successful migration.");
  }
 }catch(e){console.error("[UNB IMPORT] Startup import failed:",e);}
 console.log("============================================================");
}

async function economyLog(g,title,description,fields=[]){
 try{
  const s=(await q(`SELECT channel_id,enabled FROM economy_log_settings WHERE guild_id=$1`,[g])).rows[0];
  if(!s?.enabled||!s.channel_id)return;
  const guild=client.guilds.cache.get(g)||await client.guilds.fetch(g);
  const ch=await guild.channels.fetch(s.channel_id).catch(()=>null);
  if(!ch?.isTextBased())return;
  const e=new EmbedBuilder().setTitle(title).setDescription(description||null).setTimestamp();
  if(fields.length)e.addFields(fields.slice(0,25));
  await ch.send({embeds:[e]});
 }catch(e){console.error("Economy audit log:",e.message);}
}
async function balanceField(g,u){
 if(!u)return null;
 const a=await acct(g,u);
 return {name:"Wallet After",value:rm(a.wallet),inline:true};
}
async function acct(g,u){await q(`INSERT INTO economy_accounts(guild_id,user_id,wallet,starter_grant_claimed) VALUES($1,$2,$3,TRUE) ON CONFLICT DO NOTHING`,[g,u,START]);return (await q(`SELECT * FROM economy_accounts WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];}
async function grant(g,u){const r=await q(`INSERT INTO economy_accounts(guild_id,user_id,wallet,starter_grant_claimed) VALUES($1,$2,$3,TRUE) ON CONFLICT DO NOTHING RETURNING user_id`,[g,u,START]);if(r.rowCount){await tx(g,null,u,START,"starter_grant","New Member Starting Grant");return true;}return false;}
async function tx(g,f,t,a,type,note=""){
 await q(`INSERT INTO economy_transactions(guild_id,from_user_id,to_user_id,amount,type,note) VALUES($1,$2,$3,$4,$5,$6)`,[g,f,t,a,type,note]);
 const fields=[
  ...(f?[{name:"From",value:`<@${f}>`,inline:true}]:[]),
  ...(t?[{name:"To",value:`<@${t}>`,inline:true}]:[]),
  {name:"Amount",value:rm(a),inline:true},
  {name:"Type",value:String(type).replaceAll("_"," "),inline:true},
  ...(note?[{name:"Reason",value:String(note).slice(0,1024),inline:false}]:[])
 ];
 if(t){const bf=await balanceField(g,t);if(bf)fields.push(bf);}
 await economyLog(g,"💰 Economy Transaction",`${type}`,fields);
}
async function take(g,u,a){const r=await q(`UPDATE economy_accounts SET wallet=wallet-$3 WHERE guild_id=$1 AND user_id=$2 AND wallet>=$3 RETURNING wallet`,[g,u,a]);return r.rowCount>0;}
async function give(g,u,a){await acct(g,u);await q(`UPDATE economy_accounts SET wallet=wallet+$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,a]);}
const salaryDefaults=[["Sovereign Grant","grant",1500],["Major Business Owner","business",1200],["Business Owner","business",700],["High Government Pay","government",1000],["Medium Government Pay","government",700],["Low Government Pay","government",450],["Security Sector Salary","security",600],["White Collar Worker","worker",500],["Blue Collar Worker","worker",400],["Large Property Owner","property",600],["Medium Property","property",350],["Small Property Owner","property",200]];
async function seedRoles(guild){await guild.roles.fetch();for(const [n,c,a] of salaryDefaults){const roleId=ECONOMIC_ROLE_IDS[n],r=roleId?guild.roles.cache.get(roleId):null;if(r)await q(`INSERT INTO economy_salary_roles VALUES($1,$2,$3,$4,$5) ON CONFLICT(guild_id,role_id) DO UPDATE SET role_name=$3,category=$4,amount=$5`,[guild.id,r.id,n,c,a]);else console.warn(`Economic role missing in guild: ${n} (${roleId||"no id"})`);}}
async function payroll(member){const rows=(await q(`SELECT * FROM economy_salary_roles WHERE guild_id=$1`,[member.guild.id])).rows.filter(r=>member.roles.cache.has(r.role_id)),cats={};for(const r of rows)if(!cats[r.category]||+r.amount>+cats[r.category].amount)cats[r.category]=r;return Object.values(cats);}
function intOpt(s){return s.addIntegerOption(o=>o.setName("amount").setDescription("Amount of Reichsmark").setRequired(true).setMinValue(1));}

const commands=[
 new SlashCommandBuilder().setName("release").setDescription("Release an inmate and restore eligible roles").setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles).addUserOption(o=>o.setName("user").setDescription("Prisoner to release").setRequired(true)),
 new SlashCommandBuilder().setName("balance").setDescription("View an account").addUserOption(o=>o.setName("user").setDescription("Member")),
 new SlashCommandBuilder().setName("account").setDescription("View your financial profile"),
 intOpt(new SlashCommandBuilder().setName("pay").setDescription("Pay another member").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true))),
 new SlashCommandBuilder().setName("daily").setDescription("Claim daily RM"),
 new SlashCommandBuilder().setName("work").setDescription("Work for RM"),
 new SlashCommandBuilder().setName("rob").setDescription("Attempt a chaotic RM wallet robbery")
  .addUserOption(o=>o.setName("user").setDescription("Member to rob").setRequired(true)),
 intOpt(new SlashCommandBuilder().setName("deposit").setDescription("Deposit wallet RM into bank")),
 intOpt(new SlashCommandBuilder().setName("withdraw").setDescription("Withdraw bank RM")),
 new SlashCommandBuilder().setName("leaderboard").setDescription("Richest accounts"),
 new SlashCommandBuilder().setName("transactions").setDescription("Recent transactions"),
 new SlashCommandBuilder().setName("salary").setDescription("View salary"),
 new SlashCommandBuilder().setName("paycheck").setDescription("Claim 24-hour payroll"),
 new SlashCommandBuilder().setName("treasury").setDescription("Government treasury"),
 new SlashCommandBuilder().setName("casino").setDescription("Play an RM-only casino game")
  .addStringOption(o=>o.setName("game").setDescription("Game").setRequired(true).addChoices({name:"Coinflip",value:"coinflip"},{name:"Dice",value:"dice"},{name:"Slots",value:"slots"},{name:"Blackjack",value:"blackjack"},{name:"Roulette",value:"roulette"},{name:"Cock Fight (virtual)",value:"cockfight"},{name:"Russian Roulette (virtual)",value:"russianroulette"}))
  .addIntegerOption(o=>o.setName("bet").setDescription("RM wager").setRequired(true).setMinValue(1))
  .addStringOption(o=>o.setName("choice").setDescription("Heads/tails or red/black")),
 new SlashCommandBuilder().setName("lottery").setDescription("Reichsmark lottery")
  .addSubcommand(s=>s.setName("status").setDescription("View lottery"))
  .addSubcommand(s=>s.setName("buy").setDescription("Buy tickets").addIntegerOption(o=>o.setName("tickets").setDescription("Tickets").setRequired(true).setMinValue(1).setMaxValue(100))),
 new SlashCommandBuilder().setName("shop").setDescription("Browse the Reichsmark shop"),
 new SlashCommandBuilder().setName("buy").setDescription("Buy a shop item").addIntegerOption(o=>o.setName("item").setDescription("Shop item ID").setRequired(true).setMinValue(1)),
 new SlashCommandBuilder().setName("inventory").setDescription("View your inventory"),
 new SlashCommandBuilder().setName("use").setDescription("Use an owned shop item by its ID").addIntegerOption(o=>o.setName("item").setDescription("Inventory item ID (see !inventory)").setRequired(true).setMinValue(1)),
 new SlashCommandBuilder().setName("properties").setDescription("View your properties"),
 new SlashCommandBuilder().setName("stocks").setDescription("View the fictional Reichsmark stock market"),
 new SlashCommandBuilder().setName("portfolio").setDescription("View your fictional stock portfolio"),
 new SlashCommandBuilder().setName("shares").setDescription("View your stock shares, cost basis, value, and profit or loss"),
 new SlashCommandBuilder().setName("stock").setDescription("Trade or inspect fictional stocks")
  .addSubcommand(s=>s.setName("info").setDescription("Detailed company and market information").addStringOption(o=>o.setName("symbol").setDescription("Ticker").setRequired(true)))
  .addSubcommand(s=>s.setName("buy").setDescription("Buy shares").addStringOption(o=>o.setName("symbol").setDescription("Ticker").setRequired(true)).addIntegerOption(o=>o.setName("shares").setDescription("Shares").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("sell").setDescription("Sell shares").addStringOption(o=>o.setName("symbol").setDescription("Ticker").setRequired(true)).addIntegerOption(o=>o.setName("shares").setDescription("Shares").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("trade").setDescription("Offer shares directly to another member")
   .addUserOption(o=>o.setName("user").setDescription("Member buying your shares").setRequired(true))
   .addStringOption(o=>o.setName("symbol").setDescription("Ticker").setRequired(true))
   .addIntegerOption(o=>o.setName("shares").setDescription("Shares to sell").setRequired(true).setMinValue(1))
   .addNumberOption(o=>o.setName("price").setDescription("RM price per share").setRequired(true).setMinValue(0.01))),
 new SlashCommandBuilder().setName("bet").setDescription("RM-only community betting")
  .addSubcommand(s=>s.setName("list").setDescription("List open bets"))
  .addSubcommand(s=>s.setName("enter").setDescription("Enter a bet").addIntegerOption(o=>o.setName("id").setDescription("Bet ID").setRequired(true)).addStringOption(o=>o.setName("choice").setDescription("A or B").setRequired(true).addChoices({name:"A",value:"A"},{name:"B",value:"B"})).addIntegerOption(o=>o.setName("amount").setDescription("RM wager").setRequired(true).setMinValue(1))),
 new SlashCommandBuilder().setName("chart").setDescription("Create or refresh a live fictional stock or TAIA index chart")
  .addStringOption(o=>o.setName("symbol").setDescription("Stock ticker or TAIA").setRequired(true)),
 new SlashCommandBuilder().setName("charts").setDescription("Post and keep ALL fictional stock market charts synced in this channel"),
 new SlashCommandBuilder().setName("market").setDescription("Open the live Reichsmark Stock Exchange board"),
new SlashCommandBuilder().setName("announcementlink").setDescription("Link TA announcements to the Reichsmark market").setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o=>o.setName("channel").setDescription("Official TA announcements channel").setRequired(true)),
 new SlashCommandBuilder().setName("announcementstatus").setDescription("Check TA announcement to Market News monitoring status"),
  new SlashCommandBuilder().setName("marketsetup").setDescription("Finance: connect stock-market channels")
  .addChannelOption(o=>o.setName("market_floor").setDescription("Read-only live market board channel").setRequired(true))
  .addChannelOption(o=>o.setName("market_news").setDescription("Opening/closing bell and market news channel").setRequired(true))
  .addChannelOption(o=>o.setName("trading").setDescription("Member stock trading channel").setRequired(true)),
 new SlashCommandBuilder().setName("reichsbank").setDescription("Reichsbank savings services")
  .addSubcommand(s=>s.setName("account").setDescription("View your Reichsbank savings"))
  .addSubcommand(s=>s.setName("deposit").setDescription("Move RM from bank to savings").addIntegerOption(o=>o.setName("amount").setDescription("RM amount").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("withdraw").setDescription("Move RM from savings to bank").addIntegerOption(o=>o.setName("amount").setDescription("RM amount").setRequired(true).setMinValue(1))),
 new SlashCommandBuilder().setName("economyreport").setDescription("View live national economic statistics"),
 new SlashCommandBuilder().setName("gdp").setDescription("View estimated TA economic output and historical trend"),
 new SlashCommandBuilder().setName("economyhistory").setDescription("View hourly national economy history (last 24 hours)"),
 new SlashCommandBuilder().setName("credit").setDescription("View your fictional TA credit profile"),
 new SlashCommandBuilder().setName("loan").setDescription("Reichsbank lending")
  .addSubcommand(s=>s.setName("status").setDescription("View active loans"))
  .addSubcommand(s=>s.setName("payoff").setDescription("Pay off an active loan early").addIntegerOption(o=>o.setName("id").setDescription("Loan ID from /loan status").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("borrow").setDescription("Apply for a Reichsbank loan").addIntegerOption(o=>o.setName("amount").setDescription("RM amount").setRequired(true).setMinValue(100).setMaxValue(50000)).addIntegerOption(o=>o.setName("days").setDescription("Term in days").setRequired(true).setMinValue(7).setMaxValue(60))),
 new SlashCommandBuilder().setName("business").setDescription("Business ownership and operations")
  .addSubcommand(s=>s.setName("list").setDescription("View your businesses"))
  .addSubcommand(s=>s.setName("create").setDescription("Register a business").addStringOption(o=>o.setName("name").setDescription("Business name").setRequired(true).setMaxLength(60)).addStringOption(o=>o.setName("type").setDescription("Business type").setRequired(true)))
  .addSubcommand(s=>s.setName("withdraw").setDescription("Withdraw business funds").addIntegerOption(o=>o.setName("id").setDescription("Business ID").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(1)))
   .addSubcommand(s=>s.setName("deposit").setDescription("Deposit personal RM into a business").addIntegerOption(o=>o.setName("id").setDescription("Business ID").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(1))),
 new SlashCommandBuilder().setName("career").setDescription("Jobs and career progression")
  .addSubcommand(s=>s.setName("profile").setDescription("View career profile"))
  .addSubcommand(s=>s.setName("choose").setDescription("Choose an occupation").addStringOption(o=>o.setName("career").setDescription("Occupation").setRequired(true).addChoices({name:"Civil Service",value:"Civil Service"},{name:"Finance",value:"Finance"},{name:"Industry",value:"Industry"},{name:"Transport",value:"Transport"},{name:"Technology",value:"Technology"},{name:"Commerce",value:"Commerce"},{name:"Property",value:"Property"})))
  .addSubcommand(s=>s.setName("shift").setDescription("Work a career shift")),
 new SlashCommandBuilder().setName("wealth").setDescription("National wealth statistics"),
 new SlashCommandBuilder().setName("orders").setDescription("View your open stock limit orders"),
 new SlashCommandBuilder().setName("limitorder").setDescription("Place a fictional stock limit order")
  .addStringOption(o=>o.setName("side").setDescription("Buy or sell").setRequired(true).addChoices({name:"Buy",value:"buy"},{name:"Sell",value:"sell"}))
  .addStringOption(o=>o.setName("symbol").setDescription("Ticker").setRequired(true))
  .addIntegerOption(o=>o.setName("shares").setDescription("Shares").setRequired(true).setMinValue(1))
  .addNumberOption(o=>o.setName("price").setDescription("Limit price RM").setRequired(true).setMinValue(1)),
 new SlashCommandBuilder().setName("finance").setDescription("Finance administration control center")
  .addSubcommand(s=>s.setName("dashboard").setDescription("Finance control center"))
  .addSubcommand(s=>s.setName("spend").setDescription("Record treasury spending").addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(1)).addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)))
  .addSubcommand(s=>s.setName("dividends").setDescription("Issue automatic dividends to shareholders")),
 new SlashCommandBuilder().setName("economyimport").setDescription("Import current members from the legacy UnbelievaBoat economy")
  .addSubcommand(s=>s.setName("preview").setDescription("Preview the legacy balance import without changing money"))
  .addSubcommand(s=>s.setName("execute").setDescription("Import legacy balances for current non-bot members only")),
 new SlashCommandBuilder().setName("economylog").setDescription("Configure the economy audit log")
  .addSubcommand(s=>s.setName("setup").setDescription("Set the economy audit log channel").addChannelOption(o=>o.setName("channel").setDescription("Audit log channel").setRequired(true)))
  .addSubcommand(s=>s.setName("status").setDescription("View economy audit log status"))
  .addSubcommand(s=>s.setName("disable").setDescription("Disable economy audit logging")),
 new SlashCommandBuilder().setName("budget").setDescription("View the interim national budget and automatic fiscal policy"),
 new SlashCommandBuilder().setName("policy").setDescription("View automatic taxes, inflation indexing, and CPI policy"),
 new SlashCommandBuilder().setName("government").setDescription("Open the complete Reichsmark national economic dashboard"),
 new SlashCommandBuilder().setName("economy").setDescription("Economy administration • Admin / Commissar of Finance")
  .addSubcommand(s=>s.setName("setup").setDescription("Initialize economy systems"))
  .addSubcommand(s=>s.setName("initialize").setDescription("Create RM 50 accounts for current members"))
  .addSubcommand(s=>s.setName("add").setDescription("Add RM").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("remove").setDescription("Remove RM").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("set").setDescription("Set wallet").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(0)))
  .addSubcommand(s=>s.setName("salary").setDescription("Configure salary role").addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("Daily RM").setRequired(true).setMinValue(0)).addStringOption(o=>o.setName("category").setDescription("Category").setRequired(true).addChoices({name:"Government",value:"government"},{name:"Security",value:"security"},{name:"Worker",value:"worker"},{name:"Business",value:"business"},{name:"Property",value:"property"},{name:"Grant",value:"grant"})))
  .addSubcommand(s=>s.setName("shop-add").setDescription("Add shop item").addStringOption(o=>o.setName("name").setDescription("Name").setRequired(true)).addIntegerOption(o=>o.setName("price").setDescription("RM price").setRequired(true).setMinValue(1)).addStringOption(o=>o.setName("type").setDescription("Type").setRequired(true).addChoices({name:"Item",value:"item"},{name:"House",value:"house"},{name:"Land",value:"land"},{name:"Business",value:"business"})).addStringOption(o=>o.setName("description").setDescription("Description")))
  .addSubcommand(s=>s.setName("stock-add").setDescription("Create fictional stock").addStringOption(o=>o.setName("symbol").setDescription("Ticker").setRequired(true)).addStringOption(o=>o.setName("name").setDescription("Company").setRequired(true)).addIntegerOption(o=>o.setName("price").setDescription("Starting RM/share").setRequired(true).setMinValue(1)).addIntegerOption(o=>o.setName("supply").setDescription("Share supply").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("lottery-draw").setDescription("Draw the lottery now"))
  .addSubcommand(s=>s.setName("bet-create").setDescription("Create community bet").addStringOption(o=>o.setName("title").setDescription("Event").setRequired(true)).addStringOption(o=>o.setName("option_a").setDescription("Option A").setRequired(true)).addStringOption(o=>o.setName("option_b").setDescription("Option B").setRequired(true)))
  .addSubcommand(s=>s.setName("bet-settle").setDescription("Settle community bet").addIntegerOption(o=>o.setName("id").setDescription("Bet ID").setRequired(true)).addStringOption(o=>o.setName("winner").setDescription("Winning side").setRequired(true).addChoices({name:"A",value:"A"},{name:"B",value:"B"})))
  .addSubcommand(s=>s.setName("gov-debt").setDescription("Set government debt").addIntegerOption(o=>o.setName("amount").setDescription("Debt in RM").setRequired(true).setMinValue(0)))
  .addSubcommand(s=>s.setName("gov-borrow").setDescription("Borrow RM into treasury").addIntegerOption(o=>o.setName("amount").setDescription("RM to borrow").setRequired(true).setMinValue(1)).addStringOption(o=>o.setName("note").setDescription("Reason")))
  .addSubcommand(s=>s.setName("gov-repay").setDescription("Repay government debt from treasury").addIntegerOption(o=>o.setName("amount").setDescription("RM to repay").setRequired(true).setMinValue(1)))
  .addSubcommand(s=>s.setName("gov-spend").setDescription("Government treasury spending").addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(1)).addStringOption(o=>o.setName("category").setDescription("Category").setRequired(true)).addStringOption(o=>o.setName("note").setDescription("Description")))
  .addSubcommand(s=>s.setName("gov-revenue").setDescription("Record non-tax government revenue").addIntegerOption(o=>o.setName("amount").setDescription("RM").setRequired(true).setMinValue(1)).addStringOption(o=>o.setName("category").setDescription("Category").setRequired(true)).addStringOption(o=>o.setName("note").setDescription("Description")))
  .addSubcommand(s=>s.setName("gov-reserve").setDescription("Set central reserve balance").addIntegerOption(o=>o.setName("amount").setDescription("Reserve RM").setRequired(true).setMinValue(0)))
  .addSubcommand(s=>s.setName("gov-budget").setDescription("Set budget name and spending limit").addStringOption(o=>o.setName("name").setDescription("Budget name").setRequired(true)).addIntegerOption(o=>o.setName("limit").setDescription("Spending limit RM").setRequired(true).setMinValue(0)))
].map(x=>x.toJSON());

// ── UNIVERSAL ! PREFIX ADAPTER ────────────────────────────────────────
// Every registered slash command can also be called with ! using the same
// command/subcommand/option order. Quoted strings are supported.
function prefixTokens(input){
 const out=[];let cur="",quote=null,esc=false;
 for(const ch of String(input||"")){
  if(esc){cur+=ch;esc=false;continue;}
  if(ch==="\\"){esc=true;continue;}
  if(quote){if(ch===quote)quote=null;else cur+=ch;continue;}
  if(ch==='"'||ch==="'"){quote=ch;continue;}
  if(/\s/.test(ch)){if(cur){out.push(cur);cur="";}}else cur+=ch;
 }
 if(cur)out.push(cur);
 return out;
}
function prefixId(v){return String(v||"").replace(/[<@!#&>]/g,"");}
function prefixUsage(def){
 const subs=(def.options||[]).filter(o=>o.type===1).map(o=>o.name);
 if(subs.length)return `!${def.name} <${subs.join("|")}> ...`;
 const opts=(def.options||[]).map(o=>`${o.required?"<":"["}${o.name}${o.required?">":"]"}`).join(" ");
 return `!${def.name}${opts?" "+opts:""}`;
}
async function buildPrefixInteraction(message,rawTokens){
 if(!message.member)message.member=await message.guild.members.fetch(message.author.id);
 let tokens=[...rawTokens],cmd=(tokens.shift()||"").toLowerCase();
 const alias={
  bal:["balance"],dep:["deposit"],with:["withdraw"],
  bj:["casino","blackjack"],blackjack:["casino","blackjack"],
  cf:["casino","coinflip"],coinflip:["casino","coinflip"],
  dice:["casino","dice"],slots:["casino","slots"],roulette:["casino","roulette"],
  cockfight:["casino","cockfight"],cock:["casino","cockfight"],
  rr:["casino","russianroulette"],russianroulette:["casino","russianroulette"]
 };
 if(alias[cmd]){tokens=[...alias[cmd].slice(1),...tokens];cmd=alias[cmd][0];}
 const def=commands.find(c=>c.name===cmd);
 if(!def)return null;

 // Respect slash-command default permissions for prefix use too.
 if(def.default_member_permissions){
  const needed=BigInt(def.default_member_permissions);
  if(!message.member.permissions.has(needed))throw new Error("PREFIX_PERMISSION_DENIED");
 }

 let optionDefs=def.options||[],sub=null;
 const subDefs=optionDefs.filter(o=>o.type===1);
 if(subDefs.length){
  const wanted=(tokens.shift()||"").toLowerCase();
  const sd=subDefs.find(o=>o.name===wanted);
  if(!sd)throw new Error(`PREFIX_USAGE:${prefixUsage(def)}`);
  sub=sd.name;optionDefs=sd.options||[];
 }
 const values={};
 for(let n=0;n<optionDefs.length;n++){
  const od=optionDefs[n];
  let v=tokens.shift();
  if(v==null||v===""){
   if(od.required)throw new Error(`PREFIX_USAGE:${prefixUsage(def)}`);
   continue;
  }
  if(od.type===4){v=Number.parseInt(v,10);if(!Number.isInteger(v))throw new Error(`PREFIX_USAGE:${prefixUsage(def)}`);}
  else if(od.type===10){v=Number(v);if(!Number.isFinite(v))throw new Error(`PREFIX_USAGE:${prefixUsage(def)}`);}
  else if(od.type===5)v=["true","yes","1","on"].includes(String(v).toLowerCase());
  values[od.name]=v;
 }
 // Let the last string option consume any remaining words.
 const last=optionDefs[optionDefs.length-1];
 if(tokens.length&&last?.type===3&&values[last.name]!=null)values[last.name]+=" "+tokens.join(" ");

 let response=null;
 const sendPayload=async payload=>{
  const clean=typeof payload==="string"?{content:payload}:{...(payload||{})};
  delete clean.ephemeral;delete clean.flags;
  if(response){response=await response.edit(clean);return response;}
  response=await message.reply(clean);return response;
 };
 const get=(name,required=false)=>{
  const v=values[name];
  if((v==null||v==="")&&required)throw new Error(`Missing required option: ${name}`);
  return v??null;
 };
 const options={
  getSubcommand:(required=true)=>{if(!sub&&required)throw new Error("No subcommand specified.");return sub;},
  getString:(n,r=false)=>{const v=get(n,r);return v==null?null:String(v);},
  getInteger:(n,r=false)=>{const v=get(n,r);return v==null?null:Number.parseInt(v,10);},
  getNumber:(n,r=false)=>{const v=get(n,r);return v==null?null:Number(v);},
  getBoolean:(n,r=false)=>{const v=get(n,r);return v==null?null:Boolean(v);},
  getUser:(n,r=false)=>{const id=prefixId(get(n,r));return id?message.client.users.cache.get(id)||null:null;},
  getMember:(n)=>{const id=prefixId(get(n,false));return id?message.guild.members.cache.get(id)||null:null;},
  getRole:(n,r=false)=>{const id=prefixId(get(n,r));return id?message.guild.roles.cache.get(id)||null:null;},
  getChannel:(n,r=false)=>{const id=prefixId(get(n,r));return id?message.guild.channels.cache.get(id)||null:null;}
 };
 // Fetch user/member/channel/role values that are not cached.
 for(const od of optionDefs){
  const raw=values[od.name];if(raw==null)continue;const id=prefixId(raw);
  if(od.type===6&&!message.client.users.cache.has(id))await message.client.users.fetch(id).catch(()=>null);
  if(od.type===6&&!message.guild.members.cache.has(id))await message.guild.members.fetch(id).catch(()=>null);
  if(od.type===7&&!message.guild.channels.cache.has(id))await message.guild.channels.fetch(id).catch(()=>null);
  if(od.type===8&&!message.guild.roles.cache.has(id))await message.guild.roles.fetch().catch(()=>null);
 }
 return {
  id:`prefix-${message.id}`,commandName:cmd,guild:message.guild,guildId:message.guild.id,
  channel:message.channel,channelId:message.channel.id,user:message.author,member:message.member,
  options,client:message.client,createdTimestamp:message.createdTimestamp,
  isButton:()=>false,isChatInputCommand:()=>true,
  reply:sendPayload,editReply:sendPayload,followUp:async p=>message.channel.send(typeof p==="string"?{content:p}:p),
  deferReply:async()=>({}),deferred:false,replied:false
 };
}
// Staff-only mass role assignment: !massrole add @Role to @Role
// The first role is granted to every member who currently has the second role.
client.on("messageCreate",async message=>{
 if(!message.guild||message.guild.id!==GUILD_ID||message.author.bot)return;
 if(!/^!massrole(?:\s|$)/i.test(message.content))return;
 const args=message.content.trim().match(/^!massrole\s+add\s+(?:<@&(\d+)>|(\d{17,20}))\s+to\s+(?:<@&(\d+)>|(\d{17,20}))\s*$/i);
 if(!message.member.permissions.has(PermissionFlagsBits.ManageRoles))return message.reply("⛔ You need Manage Roles to use this command.");
 if(!args)return message.reply("Usage: `!massrole add @RoleToGive to @RoleMembersHave` (role IDs also work).");
 const addId=args[1]||args[2], targetId=args[3]||args[4];
 if(addId===targetId)return message.reply("⚠️ Those are the same role. Nothing to change.");
 try{
  const guild=message.guild;
  const bot=await guild.members.fetchMe();
  const [addRole,targetRole]=await Promise.all([guild.roles.fetch(addId),guild.roles.fetch(targetId)]);
  if(!addRole||!targetRole)return message.reply("⚠️ One of those roles was not found.");
  if(addRole.id===guild.id||addRole.managed||!addRole.editable||bot.roles.highest.comparePositionTo(addRole)<=0)
   return message.reply("⛔ I cannot assign that role. Place my bot role above it and give me Manage Roles.");
  if(targetRole.id===guild.id)return message.reply("⚠️ Please select a specific source role, not @everyone.");
  const status=await message.reply(`⏳ Finding members with **${targetRole.name}** to give **${addRole.name}**...`);
  const members=await guild.members.fetch();
  const matches=members.filter(m=>!m.user.bot&&m.roles.cache.has(targetRole.id)&&!m.roles.cache.has(addRole.id));
  let added=0,failed=0;
  for(const member of matches.values()){
   try{await member.roles.add(addRole,`Massrole by ${message.author.tag} (${message.author.id})`);added++;}
   catch(e){failed++;console.error(`[MASSROLE] ${member.id}:`,e.message);}
  }
  await status.edit(`✅ **Mass role completed**\nAdded **${addRole.name}** to **${added}** members with **${targetRole.name}**.\nFailed: **${failed}**. Already assigned members were skipped.`);
 }catch(e){console.error("[MASSROLE]",e);await message.reply("⚠️ Massrole failed. Check my permissions and role position.").catch(()=>null);}
});

client.on("messageCreate",async message=>{
 if(!message.guild||message.guild.id!==GUILD_ID||message.author.bot||!message.content.startsWith("!")||message.content.startsWith("!!"))return;
 const raw=message.content.slice(1).trim();if(!raw)return;
 const tokens=prefixTokens(raw),typed=(tokens[0]||"").toLowerCase();
 // Convenience: !dep all / !deposit all deposits the caller's entire wallet.
 // Convert "all" to the live wallet amount before routing through /deposit.
 if((typed==="dep"||typed==="deposit")&&String(tokens[1]||"").toLowerCase()==="all"){
  const a=await acct(message.guild.id,message.author.id);
  const wallet=Math.floor(Number(a.wallet)||0);
  if(wallet<=0)return message.reply("🏦 Your wallet is empty — there is nothing to deposit.");
  tokens[1]=String(wallet);
 }
 // The older quick-command listener is disabled below; all ! commands route
 // through the exact same interaction handler as their slash-command version.
 try{
  const fake=await buildPrefixInteraction(message,tokens);
  if(!fake){
   if(typed==="help"){
    const names=commands.map(c=>`!${c.name}`).join(" • ");
    return message.reply({embeds:[new EmbedBuilder().setTitle("💠 Reichsmark Commands").setDescription(`Every slash command also works with **!**.\n\n${names}\n\nGame shortcuts: **!bj <bet>**, **!cockfight <bet> [a|b]**, **!rr <bet>**, **!slots <bet>**, **!dice <bet>**, **!coinflip <bet> heads|tails**, **!roulette <bet> red|black**.`).setFooter({text:"TA Reichsmark Economy • !help"})]});
   }
   return;
  }
  client.emit("interactionCreate",fake);
 }catch(e){
  if(e.message==="PREFIX_PERMISSION_DENIED")return message.reply("⛔ You do not have permission to use that command.");
  if(e.message?.startsWith("PREFIX_USAGE:"))return message.reply(`Usage: \`${e.message.slice(13)}\``);
  console.error("[UNIVERSAL PREFIX]",e);
  return message.reply("⚠️ That command could not be parsed. Use `!help` or the slash-command version.");
 }
});


async function drawLottery(g){
 const lot=(await q(`SELECT * FROM economy_lottery WHERE guild_id=$1`,[g])).rows[0],tickets=(await q(`SELECT * FROM economy_lottery_tickets WHERE guild_id=$1 AND tickets>0`,[g])).rows;
 const total=tickets.reduce((s,r)=>s+r.tickets,0);if(!total)return null;
 let pick=crypto.randomInt(total),winner;for(const r of tickets){if(pick<r.tickets){winner=r.user_id;break;}pick-=r.tickets;}
 await give(g,winner,+lot.jackpot);await tx(g,null,winner,+lot.jackpot,"lottery_win","Lottery jackpot");
 await q(`DELETE FROM economy_lottery_tickets WHERE guild_id=$1`,[g]);await q(`UPDATE economy_lottery SET jackpot=500,draw_at=NOW()+INTERVAL '7 days' WHERE guild_id=$1`,[g]);
 return {winner,jackpot:+lot.jackpot};
}

const MARKET_TZ="America/New_York";
function marketClock(d=new Date()){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:MARKET_TZ,weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);
 const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return {weekday:v.weekday,date:`${v.year}-${v.month}-${v.day}`,hour:+v.hour,minute:+v.minute};
}
function marketIsOpen(d=new Date()){const x=marketClock(d);return x.weekday!=="Sun" && (x.hour>9||x.hour===9) && x.hour<16;}
function marketStatusText(){const x=marketClock(),open=marketIsOpen();return `${open?"🟢 MARKET OPEN":"🔴 MARKET CLOSED"} • ${x.weekday} ${x.date} • ${String(x.hour).padStart(2,"0")}:${String(x.minute).padStart(2,"0")} ET`;}
async function marketIndexes(g){
 const stocks=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND active=TRUE ORDER BY symbol`,[g])).rows;
 const avg=arr=>arr.length?arr.reduce((a,x)=>a+ +x.price,0)/arr.length:0;
 const base=avg(stocks);
 const business=avg(stocks.filter(x=>["RBT","NWI","IMF","NPG"].includes(x.symbol)));
 return {taia:base*100,tac:base*75,tabi:business*60,stocks};
}
async function ensureMarketSession(g){
 const c=marketClock(),idx=await marketIndexes(g);
 await q(`INSERT INTO economy_market_sessions(guild_id,session_date,taia_open,taia_high,taia_low,tac_open,tac_high,tac_low,tabi_open,tabi_high,tabi_low)
 VALUES($1,$2,$3,$3,$3,$4,$4,$4,$5,$5,$5) ON CONFLICT DO NOTHING`,[g,c.date,idx.taia,idx.tac,idx.tabi]);
 for(const s of idx.stocks)await q(`INSERT INTO economy_market_daily_stock(guild_id,session_date,stock_id,open,high,low)
 VALUES($1,$2,$3,$4,$4,$4) ON CONFLICT DO NOTHING`,[g,c.date,s.id,s.price]);
 return c.date;
}
async function updateMarketSession(g){
 const date=await ensureMarketSession(g),idx=await marketIndexes(g);
 await q(`UPDATE economy_market_sessions SET taia_high=GREATEST(taia_high,$3),taia_low=LEAST(taia_low,$3),tac_high=GREATEST(tac_high,$4),tac_low=LEAST(tac_low,$4),tabi_high=GREATEST(tabi_high,$5),tabi_low=LEAST(tabi_low,$5) WHERE guild_id=$1 AND session_date=$2`,[g,date,idx.taia,idx.tac,idx.tabi]);
 for(const s of idx.stocks)await q(`UPDATE economy_market_daily_stock SET high=GREATEST(high,$4),low=LEAST(low,$4) WHERE guild_id=$1 AND session_date=$2 AND stock_id=$3`,[g,date,s.id,s.price]);
}
async function buildMarketDashboard(g){
 const idx=await marketIndexes(g),c=marketClock(),open=marketIsOpen();
 const session=(await q(`SELECT * FROM economy_market_sessions WHERE guild_id=$1 AND session_date=$2`,[g,c.date])).rows[0];
 const prev=(await q(`SELECT * FROM economy_market_sessions WHERE guild_id=$1 AND session_date<$2 AND taia_close IS NOT NULL ORDER BY session_date DESC LIMIT 1`,[g,c.date])).rows[0];
 const dayRows=(await q(`SELECT d.*,s.symbol,s.name,s.price,s.available_supply,s.supply,s.volume_24h
  FROM economy_market_daily_stock d JOIN economy_stocks s ON s.id=d.stock_id WHERE d.guild_id=$1 AND d.session_date=$2 ORDER BY s.symbol`,[g,c.date])).rows;
 const ref=prev?.taia_close||session?.taia_open||idx.taia,change=ref?((idx.taia-ref)/ref*100):0;
 const mapped=dayRows.map(x=>({x,pct:+x.open?((+x.price-+x.open)/+x.open*100):0}));
 const sorted=[...mapped].sort((a,b)=>b.pct-a.pct);
 const cap=idx.stocks.reduce((a,z)=>a+(+z.price*+z.supply),0),volume=idx.stocks.reduce((a,z)=>a+Number(z.volume_24h||0),0);
 const totalSupply=idx.stocks.reduce((a,z)=>a+Number(z.supply||0),0),available=idx.stocks.reduce((a,z)=>a+Number(z.available_supply||0),0);
 const adv=mapped.filter(z=>z.pct>.001).length,dec=mapped.filter(z=>z.pct<-.001).length,flat=mapped.length-adv-dec;
 const avg=mapped.length?mapped.reduce((a,z)=>a+z.pct,0)/mapped.length:0,breadth=mapped.length?((adv-dec)/mapped.length*100):0;
 const turnover=totalSupply?volume/totalSupply*100:0,floatPct=totalSupply?available/totalSupply*100:0;
 const range=session&&+session.taia_low>0?((+session.taia_high-+session.taia_low)/+session.taia_low*100):0;
 const regime=await getDailyMarketRegime(g);
 const active=(await q(`SELECT e.title,e.impact_pct,e.expires_at,s.symbol FROM economy_market_events e LEFT JOIN economy_stocks s ON s.id=e.stock_id WHERE e.guild_id=$1 AND e.active=TRUE AND e.expires_at>NOW() ORDER BY ABS(e.impact_pct) DESC,e.created_at DESC LIMIT 5`,[g])).rows;
 let policy=null,stats=null;try{policy=await fiscalPolicy(g);stats=await nationalStats(g);}catch{}
 const sentiment=clampMarket(Math.round(regime.sentiment+change*4+breadth*.12),0,100);
 const health=clampMarket(Math.round(55+change*5+breadth*.15-Math.abs(avg)*1.2+(turnover>1?7:0)),0,100);
 const risk=clampMarket(Math.round(28+Math.abs(change)*7+Math.abs(avg)*3+(100-floatPct)*.15),0,100);
 const volatility=clampMarket(Math.round(25+Math.abs(change)*8+Math.abs(avg)*4),0,100);
 const confidence=clampMarket(Math.round(50+Math.abs(breadth)*.25+Math.min(turnover,10)*2),35,92);
 const buyPressure=clampMarket(Math.round(50+breadth*.35+change*4),5,95),sellPressure=100-buyPressure;
 const floorMood=buyPressure>=70?"Strong buying pressure":buyPressure>=57?"Buyers leading":buyPressure<=30?"Heavy selling pressure":buyPressure<=43?"Sellers leading":"Balanced / two-way trade";
 const breadthLabel=breadth>40?"Broad rally":breadth>10?"Positive breadth":breadth<-40?"Broad selloff":breadth<-10?"Negative breadth":"Mixed breadth";
 const liquidity=turnover>10?"Very active":turnover>4?"Active":turnover>1?"Moderate":"Light";
 const dayClass=change>=3?"🌟 EXCEPTIONAL RALLY":change>=1.25?"🟢 STRONG POSITIVE SESSION":change>=.25?"🟢 POSITIVE SESSION":change<=-3?"🔴 SEVERE SELLOFF":change<=-1.25?"🔴 HEAVY NEGATIVE SESSION":change<=-.25?"🟠 NEGATIVE SESSION":"⚪ MIXED / FLAT SESSION";
 const cycle=change>1.5&&stats?.activity>1?"STRONG GROWTH":change>.25?"EXPANSION":change< -1.5?"CONTRACTION":change<-.25?"COOLING":"STABLE";
 const progress=open?clampMarket((((c.hour*60+c.minute)-540)/420),.03,1):1;
 const econAdvance=clampMarket(change*.22+avg*.18+breadth/100*.35,-6,6);
 const projected=clampMarket(econAdvance+(open?(econAdvance*(1-progress)*.18):0),-6,6);
 const nextBias=sentiment>=67?"🟢 SLIGHTLY BULLISH":sentiment<=33?"🔴 SLIGHTLY BEARISH":"⚪ NEUTRAL / MIXED";
 const leaders=sorted.slice(0,3).map((z,i)=>`**#${i+1} ${z.x.symbol}** • ${rm(z.x.price)} • **${z.pct>=0?"+":""}${z.pct.toFixed(2)}%** • Vol ${Number(z.x.volume_24h||0).toLocaleString()}`).join("\n")||"—";
 const laggards=[...mapped].sort((a,b)=>a.pct-b.pct).slice(0,3).map((z,i)=>`**#${i+1} ${z.x.symbol}** • ${rm(z.x.price)} • **${z.pct>=0?"+":""}${z.pct.toFixed(2)}%** • Vol ${Number(z.x.volume_24h||0).toLocaleString()}`).join("\n")||"—";
 const news=active.length?active.map(e=>{const sev=marketEventSeverity(e.impact_pct);return `${sev.emoji} **${e.symbol||"MARKET"}** • ${String(e.title).slice(0,52)} • **${+e.impact_pct>=0?"+":""}${Number(e.impact_pct).toFixed(2)}%**`;}).join("\n"):"No active market-moving bulletins.";
 const listings=mapped.map(({x,pct})=>`${pct>0?"▲":pct<0?"▼":"•"} **${x.symbol}** ${rm(x.price)} • ${pct>=0?"+":""}${pct.toFixed(2)}% • Vol ${Number(x.volume_24h||0).toLocaleString()} • Float ${Number(x.available_supply||0).toLocaleString()}`).join("\n")||"Awaiting first session.";
 const status=open?"🟢 OPEN • CONTINUOUS TRADING":"🔴 CLOSED • AWAITING NEXT SESSION";
 const bar=n=>marketBar(clampMarket(n,0,100),20);
 const terminal=["```text","ECONOMY ADVANCE / PROJECTION","          -6%       0%       +6%",`CURRENT   ${econAdvance>=0?"▲":"▼"} ${econAdvance>=0?"+":""}${econAdvance.toFixed(2)}%`,`PROJECTED ${projected>=0?"★":"◆"} ${projected>=0?"+":""}${projected.toFixed(2)}%`,"```"].join("\n");
 const summary=`The exchange is currently classified as **${dayClass}**. ${adv} securities are advancing against ${dec} declining, with ${liquidity.toLowerCase()} liquidity. The national economic cycle is **${cycle}** and the underlying randomized day regime is **${regime.emoji} ${regime.name}**.`;
 const main=new EmbedBuilder().setTitle("📈 REICHSMARK STOCK EXCHANGE • NATIONAL MARKET CENTER")
  .setDescription(`**${status}**\n**${c.weekday} ${c.date} • ${String(c.hour).padStart(2,"0")}:${String(c.minute).padStart(2,"0")} ET**\nExchange session: **Monday–Saturday • 9:00 AM–4:00 PM ET**\n\n### TAIA — Authority Industrial Average\n**${idx.taia.toFixed(2)}** ${change>=0?"▲":"▼"} **${change>=0?"+":""}${change.toFixed(2)}%** vs. previous/session reference\n${dayClass}`)
  .addFields(
   {name:"🏛️ NATIONAL EXCHANGE BOARD",value:`TAIA **${idx.taia.toFixed(2)}** • ${change>=0?"▲":"▼"} ${change>=0?"+":""}${change.toFixed(2)}%\nTAC **${idx.tac.toFixed(2)}**\nTABI **${idx.tabi.toFixed(2)}**\n**Trend:** ${change>.25?"BULLISH":change<-.25?"BEARISH":"NEUTRAL"} • **Cycle:** ${cycle}`,inline:false},
   {name:"🔔 SESSION TAPE",value:`Previous **${prev?.taia_close?Number(prev.taia_close).toFixed(2):"—"}** • Open **${session?Number(session.taia_open).toFixed(2):"—"}**\nHigh **${session?Number(session.taia_high).toFixed(2):"—"}** • Low **${session?Number(session.taia_low).toFixed(2):"—"}** • Range **${range.toFixed(2)}%**\nSession progress **${Math.round(progress*100)}%**`,inline:false},
   {name:"💰 CAPITAL & LIQUIDITY",value:`Market capitalization **${rm(Math.round(cap))}**\nVolume **${Number(volume).toLocaleString()} shares** • Turnover **${turnover.toFixed(2)}%**\nAvailable float **${floatPct.toFixed(2)}%** • Liquidity **${liquidity}**`,inline:false},
   {name:"🏟️ NATIONAL MARKET FLOOR",value:`**Order flow:** ${floorMood}\n**Breadth:** ${breadthLabel} (${breadth>=0?"+":""}${breadth.toFixed(1)})\n**Advancers / Decliners / Flat:** ${adv} / ${dec} / ${flat}\n**Average security move:** ${avg>=0?"+":""}${avg.toFixed(2)}%\n**Buy pressure:** ${bar(buyPressure)} ${buyPressure}%\n**Sell pressure:** ${bar(sellPressure)} ${sellPressure}%`,inline:false},
   {name:"🌡️ MARKET HEALTH MONITOR",value:`Health       ${bar(health)} **${health}/100**\nSentiment    ${bar(sentiment)} **${sentiment}/100**\nLiquidity    ${bar(clampMarket(turnover*8+35,0,100))} **${liquidity}**\nRisk         ${bar(risk)} **${risk}/100**\nVolatility   ${bar(volatility)} **${volatility}/100**`,inline:false}
  ).setFooter({text:"NATIONAL MARKET CENTER • dashboard 30s • market engine 60s • no real-money value"}).setTimestamp();
 const analysis=new EmbedBuilder().setTitle("📊 NATIONAL ECONOMIC & MARKET ANALYSIS")
  .addFields(
   {name:"📊 ECONOMIC ADVANCE TERMINAL",value:`${terminal}\n**Current:** ${econAdvance>=0?"⬆️":"⬇️"} ${econAdvance>=0?"+":""}${econAdvance.toFixed(2)}% • **${cycle}**\n**Projected:** ${projected>=0?"⬆️":"⬇️"} ${projected>=0?"+":""}${projected.toFixed(2)}%\nProjection confidence **${confidence}%** • ${bar(confidence)}`,inline:false},
   {name:"🧭 ECONOMIC CYCLE MONITOR",value:`Current cycle **${cycle}**\nDaily regime **${regime.emoji} ${regime.name}**\nGrowth direction **${econAdvance>.15?"▲ RISING":econAdvance<-.15?"▼ FALLING":"➡ STABLE"}**\nRecession pressure **${risk>=70?"HIGH":risk>=45?"MODERATE":"LOW"}**`,inline:false},
   {name:"🏦 MACROECONOMIC CONTROL BOARD",value:policy&&stats?`CPI **${Number(policy.cpi).toFixed(2)}** • Inflation **${Number(stats.inflation).toFixed(2)}%** • Base rate **${Number(stats.interest||0).toFixed(2)}%**\nEconomic activity **${Number(stats.activity||0).toFixed(2)}** • Sales tax **${Number(policy.salesTax||0).toFixed(2)}%** • Business tax **${Number(policy.businessTax||0).toFixed(2)}%**`:`Economic indicators syncing.`,inline:false},
   {name:"🚀 FLOOR LEADERS",value:leaders,inline:false},
   {name:"📉 FLOOR LAGGARDS",value:laggards,inline:false},
   {name:"📰 REICHSMARK MARKET NEWS WIRE",value:news.slice(0,1024),inline:false}
  ).setFooter({text:"Market conditions are calculated from live exchange, economic, liquidity and news data."});
 const outlook=new EmbedBuilder().setTitle("🔮 RISK CENTER • NEXT SESSION OUTLOOK")
  .addFields(
   {name:"⚠️ MARKET RISK CENTER",value:`Overall risk **${risk}/100** • ${risk>=70?"🔴 HIGH":risk>=45?"🟠 MODERATE":"🟢 LOW–MODERATE"}\nVolatility **${volatility}/100**\nLiquidity risk **${Math.round(100-clampMarket(turnover*8+35,0,100))}/100**\nMarket correction pressure **${clampMarket(Math.round(risk+Math.max(0,change)*2),0,100)}/100**`,inline:false},
   {name:"📅 TODAY'S MARKET CLASSIFICATION",value:`**${dayClass}**\nEconomic day type **${regime.name}**\nMarket direction **${change>.25?"BULLISH":change<-.25?"BEARISH":"MIXED"}**\nInvestor confidence **${sentiment}/100**\nMarket health **${health}/100**`,inline:false},
   {name:"🔮 NEXT SESSION MODEL",value:`Bias **${nextBias}**\nIndicative short-term range **${(-Math.max(.4,volatility/45)).toFixed(2)}% ↔ +${Math.max(.5,volatility/38).toFixed(2)}%**\nExpected volatility **${volatility>=70?"HIGH":volatility>=40?"MODERATE":"LOW"}**\nForecast confidence **${confidence}%**\n*Outlook recalculates as market news, trading, liquidity and economic conditions change.*`,inline:false},
   {name:"📋 NATIONAL MARKET SUMMARY",value:summary.slice(0,1024),inline:false},
   {name:"💹 COMPLETE EXCHANGE TAPE",value:listings.slice(0,1024),inline:false}
  ).setFooter({text:"REICHSMARK STOCK EXCHANGE • NATIONAL MARKET CENTER • no real-money value"}).setTimestamp();
 return [main,analysis,outlook];
}

function stockChartConfig(symbol,name,rows,current,ref){
 const chronological=[...rows].reverse().slice(-180);
 const labels=chronological.map(x=>new Date(x.created_at).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"}));
 const data=chronological.map(x=>Number(x.price));
 if(!data.length)data.push(Number(current)),labels.push("Now");
 const change=Number(ref)?((Number(current)-Number(ref))/Number(ref))*100:0;
 return {type:"line",data:{labels,datasets:[{label:`${symbol} • ${name}`,data,fill:true,borderWidth:3,pointRadius:0,tension:.18,
  borderColor:change>=0?"#2eaf62":"#e34848",backgroundColor:change>=0?"rgba(46,175,98,.15)":"rgba(227,72,72,.15)"}]},
  options:{responsive:true,animation:false,plugins:{legend:{display:false},title:{display:true,
   text:`${symbol}  RM ${Number(current).toFixed(2)}  ${change>=0?"+":""}${change.toFixed(2)}%`,color:"#17202a",font:{size:22}}},
   scales:{x:{ticks:{color:"#5f6368",maxTicksLimit:8},grid:{color:"rgba(0,0,0,.06)"}},
   y:{ticks:{color:"#5f6368"},grid:{color:"rgba(0,0,0,.08)"}}}}};
}
async function renderChartPng(config){
 const res=await fetch("https://quickchart.io/chart",{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({width:900,height:430,format:"png",backgroundColor:"white",chart:config})});
 if(!res.ok)throw new Error(`Chart renderer HTTP ${res.status}`);
 return Buffer.from(await res.arrayBuffer());
}
async function buildLiveStockChart(g,symbol){
 const s=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND symbol=$2 AND active=TRUE`,[g,symbol])).rows[0];
 if(!s)return null;
 const hist=(await q(`SELECT price,created_at FROM economy_stock_history WHERE stock_id=$1 ORDER BY created_at DESC LIMIT 180`,[s.id])).rows;
 const c=marketClock();
 const prev=(await q(`SELECT close FROM economy_market_daily_stock WHERE guild_id=$1 AND stock_id=$2 AND close IS NOT NULL AND session_date<$3 ORDER BY session_date DESC LIMIT 1`,[g,s.id,c.date])).rows[0];
 const ref=prev?.close||(hist.length>1?hist[hist.length-1].price:s.price);
 const pct=Number(ref)?((Number(s.price)-Number(ref))/Number(ref))*100:0;
 const prices=hist.map(x=>Number(x.price));
 const hi=prices.length?Math.max(...prices):Number(s.price),lo=prices.length?Math.min(...prices):Number(s.price);
 const embed=new EmbedBuilder().setTitle(`📉 LIVE • ${s.symbol} • ${s.name}`)
  .setDescription(`**${rm(s.price)}**  ${pct>=0?"▲":"▼"} **${pct>=0?"+":""}${pct.toFixed(2)}%**\n${marketStatusText()}`)
  .addFields(
   {name:"Recent High",value:`**${rm(hi)}**`,inline:true},
   {name:"Recent Low",value:`**${rm(lo)}**`,inline:true},
   {name:"Volume",value:`**${Number(s.volume_24h||0).toLocaleString()} shares**`,inline:true}
  )
  .setImage("attachment://stock-chart.png")
  .setFooter({text:"LIVE chart • refreshes with each 60-second market tick • fictional TA assets"})
  .setTimestamp();
 return {embed,config:stockChartConfig(s.symbol,s.name,hist,s.price,ref)};
}

function indexChartConfig(rows,current,ref){
 const chronological=[...rows].reverse().slice(-180);
 const labels=chronological.map(x=>new Date(x.created_at).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"}));
 const data=chronological.map(x=>Number(x.value));
 if(!data.length)data.push(Number(current)),labels.push("Now");
 const points=Number(current)-Number(ref||current),pct=Number(ref)?points/Number(ref)*100:0;
 return {type:"line",data:{labels,datasets:[{label:"TA INDUSTRIAL AVERAGE • TAIA",data,fill:true,borderWidth:3,pointRadius:0,tension:.18,
  borderColor:points>=0?"#2eaf62":"#e34848",backgroundColor:points>=0?"rgba(46,175,98,.15)":"rgba(227,72,72,.15)"}]},
  options:{responsive:true,animation:false,plugins:{legend:{display:false},title:{display:true,
   text:`TA INDUSTRIALS  ${Number(current).toFixed(2)}  ${points>=0?"+":""}${points.toFixed(2)}  [${pct>=0?"+":""}${pct.toFixed(2)}%]`,
   color:"#17202a",font:{size:22}}},
   scales:{x:{ticks:{color:"#5f6368",maxTicksLimit:8},grid:{color:"rgba(0,0,0,.06)"}},
   y:{ticks:{color:"#5f6368"},grid:{color:"rgba(0,0,0,.08)"}}}}};
}
async function recordTAIA(g){
 const idx=await marketIndexes(g);
 await q(`INSERT INTO economy_index_history(guild_id,index_symbol,value) VALUES($1,'TAIA',$2)`,[g,idx.taia]);
 return idx.taia;
}
async function buildLiveTAIAChart(g){
 const current=await recordTAIA(g),c=marketClock();
 const session=(await q(`SELECT * FROM economy_market_sessions WHERE guild_id=$1 AND session_date=$2`,[g,c.date])).rows[0];
 const prev=(await q(`SELECT * FROM economy_market_sessions WHERE guild_id=$1 AND session_date<$2 AND taia_close IS NOT NULL ORDER BY session_date DESC LIMIT 1`,[g,c.date])).rows[0];
 const ref=prev?.taia_close||session?.taia_open||current;
 const rows=(await q(`SELECT value,created_at FROM economy_index_history WHERE guild_id=$1 AND index_symbol='TAIA' ORDER BY created_at DESC LIMIT 180`,[g])).rows;
 const points=Number(current)-Number(ref),pct=Number(ref)?points/Number(ref)*100:0;
 const vals=rows.map(x=>Number(x.value)),hi=vals.length?Math.max(...vals):Number(current),lo=vals.length?Math.min(...vals):Number(current);
 const embed=new EmbedBuilder().setTitle("📊 LIVE • TA INDUSTRIAL AVERAGE (TAIA)")
  .setDescription(`**${Number(current).toFixed(2)}**  ${points>=0?"▲":"▼"} **${points>=0?"+":""}${points.toFixed(2)}**  **[${pct>=0?"+":""}${pct.toFixed(2)}%]**\n${marketStatusText()}`)
  .addFields(
   {name:"Session Open",value:`**${session?.taia_open?Number(session.taia_open).toFixed(2):"—"}**`,inline:true},
   {name:"Session High",value:`**${session?.taia_high?Number(session.taia_high).toFixed(2):hi.toFixed(2)}**`,inline:true},
   {name:"Session Low",value:`**${session?.taia_low?Number(session.taia_low).toFixed(2):lo.toFixed(2)}**`,inline:true},
   {name:"Previous Close",value:`**${prev?.taia_close?Number(prev.taia_close).toFixed(2):"—"}**`,inline:true},
   {name:"Index",value:"Average of all active fictional TA securities × 100",inline:false}
  )
  .setImage("attachment://taia-chart.png")
  .setFooter({text:"TAIA • refreshes every 60 seconds from live TA prices • Reichsmark market"})
  .setTimestamp();
 return {embed,config:indexChartConfig(rows,current,ref)};
}
async function syncLiveIndexCharts(){
 try{
  const rows=(await q(`SELECT * FROM economy_live_index_charts`)).rows;
  for(const row of rows)try{
   const ch=await client.channels.fetch(row.channel_id).catch(()=>null);if(!ch?.isTextBased())continue;
   const msg=await ch.messages.fetch(row.message_id).catch(()=>null);if(!msg)continue;
   if(row.index_symbol!=="TAIA")continue;
   const chart=await buildLiveTAIAChart(row.guild_id);
   const png=await renderChartPng(chart.config);
   await msg.edit({embeds:[chart.embed],files:[new AttachmentBuilder(png,{name:"taia-chart.png"})],attachments:[]});
   await q(`UPDATE economy_live_index_charts SET last_sync=NOW() WHERE guild_id=$1 AND index_symbol=$2`,[row.guild_id,row.index_symbol]);
  }catch(e){console.error("Live index chart sync:",e.message);}
 }catch(e){console.error("Live index chart loop:",e);}
}

async function syncLiveStockCharts(){
 try{
  const rows=(await q(`SELECT * FROM economy_live_stock_charts`)).rows;
  for(const row of rows)try{
   const ch=await client.channels.fetch(row.channel_id).catch(()=>null);if(!ch?.isTextBased())continue;
   const msg=await ch.messages.fetch(row.message_id).catch(()=>null);if(!msg)continue;
   // The live card redraws every 10 seconds, but price history is written only
   // when stockTick() actually changes a market price. This prevents the chart
   // from filling with duplicate flat snapshots between real market ticks.
   const chart=await buildLiveStockChart(row.guild_id,row.symbol);if(!chart)continue;
   const png=await renderChartPng(chart.config);
   await msg.edit({embeds:[chart.embed],files:[new AttachmentBuilder(png,{name:"stock-chart.png"})],attachments:[]});
   await q(`UPDATE economy_live_stock_charts SET last_sync=NOW() WHERE guild_id=$1 AND symbol=$2`,[row.guild_id,row.symbol]);
  }catch(e){console.error("Live stock chart sync:",e.message);}
 }catch(e){console.error("Live stock chart loop:",e);}
}

async function syncMarketDashboard(){
 try{
  const rows=(await q(`SELECT * FROM economy_market_dashboard`)).rows;
  for(const row of rows)try{
   const guild=await client.guilds.fetch(row.guild_id),channel=await guild.channels.fetch(row.channel_id);
   if(!channel||!channel.isTextBased())continue;
   const msg=await channel.messages.fetch(row.message_id),embeds=await buildMarketDashboard(row.guild_id);
   await msg.edit({embeds});await q(`UPDATE economy_market_dashboard SET last_sync=NOW() WHERE guild_id=$1`,[row.guild_id]);
  }catch(e){console.error("Market dashboard sync:",e.message);}
 }catch(e){console.error("Market dashboard loop:",e);}
}
async function marketBellLoop(){
 try{
  const settings=(await q(`SELECT * FROM economy_market_settings`)).rows;
  for(const s of settings){
   const c=marketClock(),tradableDay=c.weekday!=="Sun";
   if(tradableDay&&c.hour===9&&c.minute<2&&!(s.last_session_date===c.date&&s.last_bell_type==="open")){
    await ensureMarketSession(s.guild_id);
    if(s.news_channel_id){const ch=await client.channels.fetch(s.news_channel_id).catch(()=>null);if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder().setTitle("🔔 Opening Bell • Reichsmark Stock Exchange").setDescription("The Reichsmark Stock Exchange is now **OPEN**.\n\nTrading continues until **4:00 PM ET**.").addFields({name:"Session",value:"Monday–Saturday",inline:true},{name:"Market Status",value:"🟢 OPEN",inline:true}).setFooter({text:"TA Reichsmark Economy • Market News"}).setTimestamp()]});}
    await q(`UPDATE economy_market_settings SET last_session_date=$2,last_bell_type='open' WHERE guild_id=$1`,[s.guild_id,c.date]);
   }
   if(tradableDay&&c.hour===16&&c.minute<2&&!(s.last_session_date===c.date&&s.last_bell_type==="close")){
    const idx=await marketIndexes(s.guild_id);
    await ensureMarketSession(s.guild_id);
    await q(`UPDATE economy_market_sessions SET taia_close=$3,tac_close=$4,tabi_close=$5 WHERE guild_id=$1 AND session_date=$2`,[s.guild_id,c.date,idx.taia,idx.tac,idx.tabi]);
    await q(`UPDATE economy_market_daily_stock d SET close=s.price FROM economy_stocks s WHERE d.stock_id=s.id AND d.guild_id=$1 AND d.session_date=$2`,[s.guild_id,c.date]);
    if(s.news_channel_id){const ch=await client.channels.fetch(s.news_channel_id).catch(()=>null);if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder().setTitle("🔔 Closing Bell • Reichsmark Stock Exchange").setDescription("The Reichsmark Stock Exchange is now **CLOSED**.").addFields({name:"TAIA Close",value:`**${idx.taia.toFixed(2)}**`,inline:true},{name:"Market Status",value:"🔴 CLOSED",inline:true},{name:"Next Session",value:"**9:00 AM ET** on the next Monday–Saturday session",inline:false}).setFooter({text:"TA Reichsmark Economy • Market News"}).setTimestamp()]});}
    await q(`UPDATE economy_market_settings SET last_session_date=$2,last_bell_type='close' WHERE guild_id=$1`,[s.guild_id,c.date]);
   }
  }
 }catch(e){console.error("Market bell:",e);}
}


async function nationalStats(g){
 const a=(await q(`SELECT COUNT(*) citizens,COALESCE(SUM(wallet+bank),0) liquid,COALESCE(AVG(wallet+bank),0) avgwealth FROM economy_accounts WHERE guild_id=$1`,[g])).rows[0];
 const t=(await q(`SELECT balance FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0]||{balance:0};
 const s=(await q(`SELECT COALESCE(SUM(price*supply),0) cap,COALESCE(SUM(volume_24h),0) volume FROM economy_stocks WHERE guild_id=$1 AND active=TRUE`,[g])).rows[0];
 const p=(await q(`SELECT COALESCE(SUM(purchase_price),0) value,COUNT(*) count FROM economy_properties WHERE guild_id=$1`,[g])).rows[0];
 const tx=(await q(`SELECT COALESCE(SUM(amount),0) flow,COUNT(*) count FROM economy_transactions WHERE guild_id=$1 AND created_at>=NOW()-INTERVAL '24 hours'`,[g])).rows[0];
 const idx=await marketIndexes(g);
 const money=+a.liquid + +t.balance;
 // Existing TA formula is retained for compatibility; it is an activity proxy, not measured GDP.
 const gdp=Math.round((+tx.flow*30)+(+s.cap*.03)+(+p.value*.02));
 const prev=(await q(`SELECT * FROM economy_macro_history WHERE guild_id=$1 ORDER BY record_date DESC LIMIT 1`,[g])).rows[0];
 const ev=(await q(`SELECT COALESCE(SUM(activity_impact),0) a,COALESCE(SUM(inflation_impact),0) i FROM economy_economic_events WHERE guild_id=$1 AND active=TRUE AND expires_at>NOW()`,[g])).rows[0];
 const inflation=(prev&&+prev.money_supply>0?Math.max(-5,Math.min(15,((money-+prev.money_supply)/+prev.money_supply)*20)):2.0)+(+ev.i||0);
 const activity=Math.max(-10,Math.min(10,(+tx.count/Math.max(1,+a.citizens))*2+(+ev.a||0)));
 return {citizens:+a.citizens,money,avgwealth:+a.avgwealth,treasury:+t.balance,marketCap:+s.cap,volume:+s.volume,propertyValue:+p.value,properties:+p.count,flow:+tx.flow,transactions:+tx.count,gdp,inflation,activity,taia:idx.taia};
}
// Idempotent safety migration: GDP commands may arrive while startup is still initializing.
let gdpSchemaReadyPromise;
async function ensureGdpSchema(){
 if(!gdpSchemaReadyPromise){
  gdpSchemaReadyPromise=(async()=>{
   await q(`CREATE TABLE IF NOT EXISTS economy_gdp_snapshots (
    guild_id TEXT NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    estimated_output NUMERIC(20,2) NOT NULL,
    transaction_flow_24h NUMERIC(20,2) NOT NULL,
    transaction_count_24h BIGINT NOT NULL,
    money_supply NUMERIC(20,2) NOT NULL,
    treasury NUMERIC(20,2) NOT NULL,
    market_cap NUMERIC(20,2) NOT NULL,
    property_value NUMERIC(20,2) NOT NULL,
    account_count BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(guild_id,hour_bucket)
   )`);
   await q(`CREATE INDEX IF NOT EXISTS economy_gdp_snapshots_recent ON economy_gdp_snapshots(guild_id,hour_bucket DESC)`);
  })().catch(e=>{gdpSchemaReadyPromise=null;throw e;});
 }
 return gdpSchemaReadyPromise;
}
async function saveGdpSnapshot(g,x){
 await ensureGdpSchema();
 // An hourly UPSERT preserves historical samples without writing a new row every 30 seconds.
 await q(`INSERT INTO economy_gdp_snapshots
 (guild_id,hour_bucket,estimated_output,transaction_flow_24h,transaction_count_24h,money_supply,treasury,market_cap,property_value,account_count,recorded_at)
 VALUES($1,date_trunc('hour',NOW()),$2,$3,$4,$5,$6,$7,$8,$9,NOW())
 ON CONFLICT(guild_id,hour_bucket) DO UPDATE SET
 estimated_output=EXCLUDED.estimated_output,transaction_flow_24h=EXCLUDED.transaction_flow_24h,
 transaction_count_24h=EXCLUDED.transaction_count_24h,money_supply=EXCLUDED.money_supply,
 treasury=EXCLUDED.treasury,market_cap=EXCLUDED.market_cap,
 property_value=EXCLUDED.property_value,account_count=EXCLUDED.account_count,recorded_at=NOW()`,
 [g,x.gdp,x.flow,x.transactions,x.money,x.treasury,x.marketCap,x.propertyValue,x.citizens]);
}
async function gdpTrend(g,limit=24){
 await ensureGdpSchema();
 const rows=(await q(`SELECT hour_bucket,estimated_output,transaction_flow_24h,transaction_count_24h
 FROM economy_gdp_snapshots WHERE guild_id=$1 ORDER BY hour_bucket DESC LIMIT $2`,[g,limit])).rows.reverse();
 const current=rows.length?Number(rows[rows.length-1].estimated_output):0;
 const first=rows.length>1?Number(rows[0].estimated_output):null;
 const change=first!==null&&first!==0?(current-first)/first*100:null;
 const spark=rows.length?rows.map(r=>Number(r.estimated_output)) : [];
 const low=Math.min(...spark),high=Math.max(...spark),blocks='▁▂▃▄▅▆▇█';
 const chart=spark.map(v=>blocks[Math.max(0,Math.min(7,Math.round((v-low)/Math.max(1,high-low)*7)))]).join('');
 return {rows,current,change,chart};
}
async function buildGdpReport(g,history=false){
 const x=await saveNationalStats(g),t=await gdpTrend(g);
 const trend=t.change===null?'Not enough history':`${t.change>=0?'▲ +':'▼ '}${t.change.toFixed(2)}%`;
 return new EmbedBuilder().setTitle(history?'📉 NATIONAL ECONOMY • HOURLY HISTORY':'🏛️ TA • ESTIMATED NATIONAL OUTPUT')
 .setDescription(`**Estimated annualized activity proxy: ${rm(x.gdp)}**\nThis is a fictional indicator based on transaction flow and asset values, **not** official GDP or actual production.\n\n**Hourly trend** (${t.rows.length} recorded hours)\n${t.chart||'Awaiting first snapshot'}\nChange across recorded samples: **${trend}**`)
 .addFields(
 {name:'24h Transaction Activity',value:`${rm(x.flow)} across ${x.transactions.toLocaleString()} entries`,inline:true},
 {name:'Money Supply',value:rm(x.money),inline:true},
 {name:'Treasury',value:rm(x.treasury),inline:true},
 {name:'Market Capitalization',value:rm(x.marketCap),inline:true},
 {name:'Property Holdings',value:rm(x.propertyValue),inline:true},
 {name:'Tracked Accounts',value:x.citizens.toLocaleString(),inline:true})
 .setFooter({text:'Hourly PostgreSQL snapshots • live display refreshes every 30 seconds • RM has no cash value'}).setTimestamp();
}
async function saveNationalStats(g){
 const c=marketClock(),x=await nationalStats(g);
 await q(`INSERT INTO economy_macro_history(guild_id,record_date,gdp,money_supply,inflation,activity,treasury,stock_index)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8)
 ON CONFLICT(guild_id,record_date) DO UPDATE SET gdp=$3,money_supply=$4,inflation=$5,activity=$6,treasury=$7,stock_index=$8`,
 [g,c.date,x.gdp,x.money,x.inflation,x.activity,x.treasury,x.taia]);await saveGdpSnapshot(g,x);return x;
}
async function buildFinancialReport(g,title="🏦 REICHSMARK NATIONAL FINANCIAL REPORT"){
 const x=await saveNationalStats(g);
 return new EmbedBuilder().setTitle(title).setDescription(`**${marketStatusText()}**\nLive national indicators generated from the TA economy database.`)
 .addFields(
  {name:"National Economy",value:`Estimated activity proxy **${rm(x.gdp)}**\nMoney supply **${rm(x.money)}**\nEconomic activity **${x.activity>=0?"+":""}${x.activity.toFixed(2)}**\nInflation indicator **${x.inflation.toFixed(2)}%**`,inline:true},
  {name:"Public Finance",value:`Treasury **${rm(x.treasury)}**\n24h transaction flow **${rm(x.flow)}**\n24h transactions **${x.transactions.toLocaleString()}**`,inline:true},
  {name:"Households",value:`Accounts **${x.citizens.toLocaleString()}**\nAverage liquid wealth **${rm(Math.round(x.avgwealth))}**\nProperty value **${rm(x.propertyValue)}**`,inline:true},
  {name:"Capital Markets",value:`TAIA **${x.taia.toFixed(2)}**\nMarket capitalization **${rm(Math.round(x.marketCap))}**\nShare volume **${Number(x.volume).toLocaleString()}**`,inline:true}
 ).setFooter({text:"Fictional TA economic indicators • RM has no real-money value"}).setTimestamp();
}
function econBar(value,max=100,width=20){
 const n=Math.max(0,Math.min(width,Math.round((Number(value||0)/max)*width)));
 return `${"█".repeat(n)}${"░".repeat(width-n)}`;
}
async function buildEconomicDashboard(g){
 const x=await saveNationalStats(g),pol=await fiscalPolicy(g);
 const set=(await q(`SELECT * FROM economy_settings WHERE guild_id=$1`,[g])).rows[0]||{};
 const gov=(await q(`SELECT * FROM economy_government WHERE guild_id=$1`,[g])).rows[0]||{};
 const tre=(await q(`SELECT * FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0]||{};
 const rev=(await q(`SELECT COALESCE(SUM(CASE WHEN kind IN ('revenue','tax') THEN amount ELSE 0 END),0) revenue,COALESCE(SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END),0) spending FROM economy_government_ledger WHERE guild_id=$1 AND created_at>=NOW()-INTERVAL '24 hours'`,[g])).rows[0]||{};
 const biz=(await q(`SELECT COUNT(*) count,COALESCE(SUM(valuation),0) value FROM economy_businesses WHERE guild_id=$1`,[g])).rows[0]||{};
 const banks=(await q(`SELECT COALESCE(SUM(bank),0) deposits,COALESCE(SUM(wallet),0) wallets FROM economy_accounts WHERE guild_id=$1`,[g])).rows[0]||{};
 const loans=(await q(`SELECT COALESCE(SUM(principal),0) outstanding FROM economy_loans WHERE guild_id=$1 AND status='active'`,[g])).rows[0]||{};
 const debt=+gov.debt||0,reserve=+gov.reserve_balance||0,treasury=+tre.balance||0;
 const revenue=+rev.revenue||0,spending=+rev.spending||0,budget=revenue-spending;
 const totalMoney=Math.max(1,x.money+reserve),reserveRatio=reserve/totalMoney*100,debtBurden=Math.min(100,debt/Math.max(1,x.gdp)*100);
 const inflationRisk=Math.min(100,Math.abs(x.inflation-2)*14),recessionRisk=Math.max(5,Math.min(100,35-x.activity*6)),fiscalRisk=Math.min(100,debtBurden*.65+(budget<0?25:5));
 const bankingRisk=Math.min(100,(+loans.outstanding/Math.max(1,+banks.deposits))*35),systemRisk=Math.round((inflationRisk+recessionRisk+fiscalRisk+bankingRisk)/4);
 const health=Math.round(Math.max(0,Math.min(100,78+x.activity*2-Math.abs(x.inflation-2)*3-debtBurden*.12)));
 const cycle=x.activity>5?'STRONG GROWTH':x.activity>1?'EXPANSION':x.activity>-1?'STABLE':x.activity>-4?'CONTRACTION':'RECESSION';
 const condition=health>=75?'🟢 HEALTHY':health>=55?'🟡 STABLE':'🔴 STRESSED';
 const moneyFlow=x.flow;
 const e1=new EmbedBuilder().setTitle('🏦 NATIONAL ECONOMIC CENTER • REICHSMARK ECONOMY').setDescription(`**${condition} • ${cycle}**\nNational economic, monetary and public-finance terminal. Separate from the Reichsmark Stock Exchange.`).addFields(
  {name:'🇩🇪 ECONOMY AT A GLANCE',value:`Economic cycle **${cycle}**\nEconomic activity **${x.activity>=0?'+':''}${x.activity.toFixed(2)}**\nEstimated activity proxy **${rm(x.gdp)}**\nEconomic health **${health}/100**\n${econBar(health)}\nInflation **${x.inflation.toFixed(2)}%** • CPI **${(+pol.cpi).toFixed(2)}**`,inline:false},
  {name:'💵 REICHSMARK MONEY SYSTEM',value:`Total measured money **${rm(Math.round(totalMoney))}**\nCitizen wallets **${rm(+banks.wallets)}**\nBank deposits **${rm(+banks.deposits)}**\nTreasury **${rm(treasury)}**\nNational reserve **${rm(reserve)}**\nReserve ratio **${reserveRatio.toFixed(2)}%**`,inline:true},
  {name:'🏦 TREASURY & BUDGET • 24H',value:`Treasury balance **${rm(treasury)}**\nRevenue **${rm(revenue)}**\nSpending **${rm(spending)}**\nBudget balance **${budget>=0?'+':'-'}${rm(Math.abs(budget))}**\nPosition **${budget>=0?'🟢 SURPLUS':'🔴 DEFICIT'}**`,inline:true},
  {name:'🏛️ NATIONAL RESERVE',value:`Reserve **${rm(reserve)}**\nReserve / money **${reserveRatio.toFixed(2)}%**\nReserve status **${reserveRatio>=10?'🟢 STRONG':reserveRatio>=5?'🟡 ADEQUATE':'🔴 LOW'}**\nAvailable treasury + reserve **${rm(treasury+reserve)}**`,inline:true},
  {name:'💳 PUBLIC DEBT',value:`National debt **${rm(debt)}**\nDebt limit **${rm(+gov.debt_limit||0)}**\nDebt / estimated output **${debtBurden.toFixed(2)}%**\nBase interest **${(+gov.interest_rate||0).toFixed(2)}%**\nDebt condition **${debtBurden<50?'🟢 MANAGEABLE':debtBurden<80?'🟡 ELEVATED':'🔴 HIGH'}**`,inline:true}
 ).setFooter({text:'NATIONAL ECONOMIC CENTER • live Reichsmark economic data • no real-money value'}).setTimestamp();
 const e2=new EmbedBuilder().setTitle('📊 MONETARY • FINANCIAL • PRODUCTIVE ECONOMY').addFields(
  {name:'🪙 MONETARY POLICY',value:`Inflation **${x.inflation.toFixed(2)}%**\nCPI **${(+pol.cpi).toFixed(2)}**\nBase rate **${(+gov.interest_rate||0).toFixed(2)}%**\nSales tax **${(+pol.sales_tax||0).toFixed(2)}%**\nBusiness tax **${(+pol.business_tax||0).toFixed(2)}%**\nIncome tax **${(+set.income_tax||0).toFixed(2)}%**`,inline:true},
  {name:'🏦 BANKING & LIQUIDITY',value:`Deposits **${rm(+banks.deposits)}**\nOutstanding loans **${rm(+loans.outstanding)}**\n24h economic flow **${rm(moneyFlow)}**\nTransactions **${x.transactions.toLocaleString()}**\nLiquidity **${x.transactions>20?'🟢 ACTIVE':x.transactions>5?'🟡 MODERATE':'⚪ LIGHT'}**`,inline:true},
  {name:'🏢 BUSINESS & PROPERTY',value:`Businesses **${(+biz.count).toLocaleString()}**\nBusiness valuation **${rm(+biz.value)}**\nProperties **${x.properties.toLocaleString()}**\nProperty value **${rm(x.propertyValue)}**\nAverage liquid wealth **${rm(Math.round(x.avgwealth))}**`,inline:true},
  {name:'📈 CAPITAL MARKET LINK',value:`TAIA **${x.taia.toFixed(2)}**\nStock capitalization **${rm(Math.round(x.marketCap))}**\nShare volume **${x.volume.toLocaleString()}**\nThe stock exchange remains displayed separately in <#${STOCK_MARKET_DASHBOARD_CHANNEL_ID}>.`,inline:true},
  {name:'⚠️ NATIONAL ECONOMIC RISK CENTER',value:`Inflation risk **${Math.round(inflationRisk)}/100**\nDebt/fiscal risk **${Math.round(fiscalRisk)}/100**\nRecession risk **${Math.round(recessionRisk)}/100**\nBanking risk **${Math.round(bankingRisk)}/100**\n\n**SYSTEMIC RISK ${systemRisk}/100**\n${econBar(systemRisk)} • ${systemRisk<35?'🟢 LOW':systemRisk<65?'🟡 MODERATE':'🔴 HIGH'}`,inline:false}
 ).setFooter({text:'Economic dashboard refresh • 30 seconds • automatic economic engine'}).setTimestamp();
 const gdpHistory=await gdpTrend(g);
 e2.addFields({name:'📉 HOURLY ECONOMIC OUTPUT HISTORY',value:`${gdpHistory.chart||'Awaiting snapshots'}\n**${gdpHistory.rows.length}** hourly samples • **${gdpHistory.change===null?'Trend not yet available':`${gdpHistory.change>=0?'+':''}${gdpHistory.change.toFixed(2)}%`}** across recorded samples\nUse **!gdp** or **!economyhistory** for details.\n*Estimated activity proxy, not measured GDP.*`,inline:false});
 const outlook=x.activity>1&&x.inflation<5?'POSITIVE':x.activity<-1?'CAUTIOUS':'STABLE';
 const e3=new EmbedBuilder().setTitle('🔮 NATIONAL ECONOMIC OUTLOOK & BRIEF').setDescription(`**OUTLOOK: ${outlook==='POSITIVE'?'🟢':outlook==='CAUTIOUS'?'🟠':'⚪'} ${outlook}**`).addFields(
  {name:'🧭 ECONOMIC CYCLE MONITOR',value:`RECESSION → CONTRACTION → STABLE → **${cycle}** → STRONG GROWTH\nGrowth direction **${x.activity>0?'▲ RISING':x.activity<0?'▼ FALLING':'➡ FLAT'}**\nRecession pressure **${recessionRisk<30?'LOW':recessionRisk<60?'MODERATE':'HIGH'}**`,inline:false},
  {name:'📋 NATIONAL ECONOMIC BRIEF',value:`The Reichsmark economy is currently classified as **${condition} • ${cycle}**. Inflation is **${x.inflation.toFixed(2)}%**, the treasury holds **${rm(treasury)}**, reserves stand at **${rm(reserve)}**, and public debt is **${rm(debt)}**. The last 24 hours recorded **${rm(x.flow)}** in transaction flow across **${x.transactions.toLocaleString()}** transactions. The current fiscal position is **${budget>=0?'a surplus of':'a deficit of'} ${rm(Math.abs(budget))}**.`,inline:false},
  {name:'🔗 MARKET ↔ ECONOMY CONNECTION',value:`Economic conditions feed market sentiment, risk and policy conditions, while capital-market activity contributes to broader financial confidence. Stock-market trading remains on the dedicated National Market Center dashboard in <#${STOCK_MARKET_DASHBOARD_CHANNEL_ID}>.`,inline:false}
 ).setFooter({text:'Treasury • reserve • debt • inflation • money • banking • business • property'}).setTimestamp();
 return [e1,e2,e3];
}
async function ensureEconomicDashboard(){
 try{
  const guild=await client.guilds.fetch(GUILD_ID),channel=await guild.channels.fetch(ECONOMIC_DASHBOARD_CHANNEL_ID).catch(()=>null);
  if(!channel?.isTextBased()){console.warn(`[ECONOMIC DASHBOARD] Channel ${ECONOMIC_DASHBOARD_CHANNEL_ID} not accessible.`);return;}
  let row=(await q(`SELECT * FROM economy_economic_dashboard WHERE guild_id=$1`,[GUILD_ID])).rows[0],msg=null;
  if(row?.message_id)msg=await channel.messages.fetch(row.message_id).catch(()=>null);
  const embeds=await buildEconomicDashboard(GUILD_ID);
  if(msg)await msg.edit({embeds});
  else{msg=await channel.send({embeds});await q(`INSERT INTO economy_economic_dashboard(guild_id,channel_id,message_id,last_sync) VALUES($1,$2,$3,NOW()) ON CONFLICT(guild_id) DO UPDATE SET channel_id=$2,message_id=$3,last_sync=NOW()`,[GUILD_ID,channel.id,msg.id]);}
 }catch(e){console.error('Economic dashboard ensure:',e);}
}
async function syncEconomicDashboard(){
 try{
  const rows=(await q(`SELECT * FROM economy_economic_dashboard`)).rows;
  if(!rows.length){await ensureEconomicDashboard();return;}
  for(const row of rows)try{
   const guild=await client.guilds.fetch(row.guild_id),channel=await guild.channels.fetch(ECONOMIC_DASHBOARD_CHANNEL_ID).catch(()=>null);if(!channel?.isTextBased())continue;
   let msg=await channel.messages.fetch(row.message_id).catch(()=>null),embeds=await buildEconomicDashboard(row.guild_id);
   if(!msg){msg=await channel.send({embeds});await q(`UPDATE economy_economic_dashboard SET channel_id=$2,message_id=$3,last_sync=NOW() WHERE guild_id=$1`,[row.guild_id,channel.id,msg.id]);}
   else{await msg.edit({embeds});await q(`UPDATE economy_economic_dashboard SET channel_id=$2,last_sync=NOW() WHERE guild_id=$1`,[row.guild_id,channel.id]);}
  }catch(e){console.error('Economic dashboard sync:',e.message);}
 }catch(e){console.error('Economic dashboard loop:',e);}
}

async function dailyFinancialReportLoop(){
 try{
  const c=marketClock();
  if(c.weekday==="Sun"||c.hour!==16||c.minute<2)return;
  const settings=(await q(`SELECT * FROM economy_market_settings`)).rows;
  for(const set of settings){
   const key=`daily_report_${c.date}`;
   const already=(await q(`SELECT value FROM economy_runtime_state WHERE guild_id=$1 AND key=$2`,[set.guild_id,key])).rows[0];
   if(already)continue;
   const ch=set.news_channel_id?await client.channels.fetch(set.news_channel_id).catch(()=>null):null;
   if(ch?.isTextBased())await ch.send({embeds:[await buildFinancialReport(set.guild_id,"📊 CLOSING BELL • DAILY FINANCIAL REPORT")]});
   await q(`INSERT INTO economy_runtime_state(guild_id,key,value) VALUES($1,$2,'posted') ON CONFLICT(guild_id,key) DO NOTHING`,[set.guild_id,key]);
  }
 }catch(e){console.error("Daily financial report:",e);}
}
async function savingsInterestLoop(){
 try{
  const rows=(await q(`SELECT * FROM economy_savings WHERE balance>0 AND last_interest_at<=NOW()-INTERVAL '24 hours'`)).rows;
  for(const r of rows){
   const interest=Math.max(1,Math.floor(+r.balance*0.0005));
   await q(`UPDATE economy_savings SET balance=balance+$3,last_interest_at=NOW() WHERE guild_id=$1 AND user_id=$2`,[r.guild_id,r.user_id,interest]);
  }
 }catch(e){console.error("Savings interest:",e);}
}


const PROPERTY_BUSINESS_CATEGORY_ID="1555734721193967646";

function propertyChannelName(type,name,userId){
 const prefix=type==="house"?"house":type==="land"?"land":type==="business"?"property-business":"property";
 const clean=String(name||"property").toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,55);
 return `${prefix}-${clean}-${String(userId).slice(-4)}`.slice(0,95);
}
async function createPrivatePropertyChannel(guild,ownerId,type,name,propertyId){
 const channel=await guild.channels.create({
  name:propertyChannelName(type,name,ownerId),
  type:ChannelType.GuildText,
  topic:`Private ${type} property • ${name} • Property #${propertyId}`,
  permissionOverwrites:[
   {id:guild.roles.everyone.id,deny:["ViewChannel"]},
   {id:ownerId,allow:["ViewChannel","SendMessages","ReadMessageHistory","AttachFiles","EmbedLinks"]},
   {id:client.user.id,allow:["ViewChannel","SendMessages","ReadMessageHistory","ManageChannels","EmbedLinks"]}
  ],
  reason:`Reichsmark property purchase: ${name}`
 });
 await channel.send({embeds:[new EmbedBuilder().setTitle(`🏠 PROPERTY RECORD • ${name}`).setDescription(`This is the private Discord space for **${name}**.\n\n**Owner:** <@${ownerId}>\n**Type:** ${type.toUpperCase()}\n**Property ID:** #${propertyId}\n\nThe channel remains tied to this fictional property record.`).setFooter({text:"TA Reichsmark property system • fictional ownership"})]});
 return channel;
}

async function setPrisonStatus(g,u,active,source){
 await q(`INSERT INTO economy_prison_status(guild_id,user_id,active,marked_at,released_at,source)
  VALUES($1,$2,$3,CASE WHEN $3 THEN NOW() ELSE NULL END,CASE WHEN $3 THEN NULL ELSE NOW() END,$4)
  ON CONFLICT(guild_id,user_id) DO UPDATE SET
   active=EXCLUDED.active,
   marked_at=CASE WHEN EXCLUDED.active THEN NOW() ELSE economy_prison_status.marked_at END,
   released_at=CASE WHEN EXCLUDED.active THEN NULL ELSE NOW() END,
   source=EXCLUDED.source`,[g,u,active,source]);
}
async function isPersistentPrisoner(g,u){
 const r=(await q(`SELECT active FROM economy_prison_status WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];
 return !!r?.active;
}
async function memberIsPrisoner(member){
 if(!member||member.user?.bot)return false;
 return member.roles.cache.has(PRISONER_ROLE_ID)||await isPersistentPrisoner(member.guild.id,member.id);
}
async function savePrisonRoleBackup(member){
 const roles=member.roles.cache.filter(r=>r.id!==member.guild.id&&r.id!==PRISONER_ROLE_ID&&!r.managed).map(r=>r.id);
 // Only save the first incarceration snapshot; never overwrite it with stripped roles.
 await q(`INSERT INTO economy_prison_role_backup(guild_id,user_id,role_ids)
  VALUES($1,$2,$3) ON CONFLICT(guild_id,user_id) DO NOTHING`,[member.guild.id,member.id,roles]);
}
async function restorePrisonRoleBackup(member){
 const record=(await q(`SELECT role_ids FROM economy_prison_role_backup WHERE guild_id=$1 AND user_id=$2`,[member.guild.id,member.id])).rows[0];
 if(!record)return;
 const roles=record.role_ids||[];
 const failures=[];
 for(const id of roles){
  if(id===PRISONER_ROLE_ID)continue;
  const role=member.guild.roles.cache.get(id)||await member.guild.roles.fetch(id).catch(()=>null);
  if(!role||role.managed||!role.editable){failures.push(id);continue;}
  if(!member.roles.cache.has(id)){
   try{await member.roles.add(role,"Restore roles after JailBot release");}
   catch(e){failures.push(id);console.warn(`[PRISON] Role restore failed ${member.id}/${id}: ${e.message}`);}
  }
 }
 if(!failures.length)await q(`DELETE FROM economy_prison_role_backup WHERE guild_id=$1 AND user_id=$2`,[member.guild.id,member.id]);
 else console.warn(`[PRISON] Roles needing manual restore for ${member.id}: ${failures.join(', ')}`);
}
// Restore membership only after the persistent prison flag is cleared.
async function releasePrisoner(member,source="staff_release"){
 const g=member.guild.id,u=member.id;
 await setPrisonStatus(g,u,false,source);
 const fresh=await member.guild.members.fetch(u);
 if(fresh.roles.cache.has(PRISONER_ROLE_ID))await fresh.roles.remove(PRISONER_ROLE_ID,"Authorized prisoner release");
 const released=await member.guild.members.fetch(u);
 await restorePrisonRoleBackup(released);
 const restored=await member.guild.members.fetch(u);
 // A former citizen keeps citizenship; everyone else gets Resident.
 const citizen=(await q(`SELECT citizen FROM economy_citizenship WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0]?.citizen;
 if(!citizen&&!restored.roles.cache.has(AUTO_ROLES.CITIZEN))await safeRoleSet(restored,AUTO_ROLES.RESIDENT,true);
 await syncFreshMember(member.guild,u);
 await economyLog(g,"🔓 Prisoner Released",`<@${u}> released (${source}); eligible roles restored.`);
}
async function enforcePrisonerRoles(member,source="prison_enforcement"){
 if(!member||member.user?.bot)return false;
 const prisonerRole=member.guild.roles.cache.get(PRISONER_ROLE_ID)||await member.guild.roles.fetch(PRISONER_ROLE_ID).catch(()=>null);
 if(!prisonerRole){
  console.error(`[PRISON] Prisoner role ${PRISONER_ROLE_ID} not found.`);
  return false;
 }

 // Ensure the prisoner role exists first.
 if(!member.roles.cache.has(PRISONER_ROLE_ID)){
  try{await member.roles.add(prisonerRole,"Persistent prisoner enforcement");}
  catch(e){console.error(`[PRISON] Could not add prisoner role to ${member.id}:`,e.message);return false;}
 }

 await savePrisonRoleBackup(member);

 // Remove every role the bot is actually allowed to remove. @everyone and Discord-managed
 // integration/bot roles cannot be removed by a bot.
 const removable=member.roles.cache.filter(r=>
  r.id!==member.guild.id &&
  r.id!==PRISONER_ROLE_ID &&
  !r.managed &&
  r.editable
 );
 if(removable.size){
  try{await member.roles.remove([...removable.keys()],"Prisoner role isolation");}
  catch(e){console.error(`[PRISON] Bulk role removal failed for ${member.id}:`,e.message);}
 }

 const blocked=member.roles.cache.filter(r=>
  r.id!==member.guild.id &&
  r.id!==PRISONER_ROLE_ID &&
  (r.managed||!r.editable)
 );
 if(blocked.size)console.warn(`[PRISON] ${member.id} has ${blocked.size} role(s) Discord will not let this bot remove.`);

 await setPrisonStatus(member.guild.id,member.id,true,source);
 await economyLog(member.guild.id,"🔒 Prisoner Roles Enforced",`<@${member.id}>`,[
  {name:"Prisoner Role",value:`<@&${PRISONER_ROLE_ID}>`,inline:true},
  {name:"Other removable roles",value:"Removed",inline:true},
  {name:"Persistence",value:"Rejoin protection active",inline:true}
 ]);
 return true;
}
function hasAnyRole(member,ids){return ids.some(id=>member.roles.cache.has(id));}
async function safeRoleSet(member,roleId,want){
 const has=member.roles.cache.has(roleId);
 if(want===has)return true;
 const role=member.guild.roles.cache.get(roleId)||await member.guild.roles.fetch(roleId).catch(()=>null);
 if(!role){console.error(`[ROLE SYNC] Role ${roleId} does not exist in guild ${member.guild.id}`);return false;}
 try{
  if(want){
   await member.roles.add(role,"Reichsmark automatic economic role sync");
   await economyLog(member.guild.id,"🔄 Economic Role Added",`<@${member.id}>`,[
    {name:"Role",value:`<@&${roleId}>`,inline:true},
    {name:"Source",value:"Automatic Role Sync",inline:true}
   ]);
  }else{
   await member.roles.remove(role,"Reichsmark automatic economic role sync");
   await economyLog(member.guild.id,"🔄 Economic Role Removed",`<@${member.id}>`,[
    {name:"Role",value:`<@&${roleId}>`,inline:true},
    {name:"Source",value:"Automatic Role Sync",inline:true}
   ]);
  }
  return true;
 }catch(e){
  console.error(`[ROLE SYNC] ${want?"ADD":"REMOVE"} failed for ${member.user?.tag||member.id} (${member.id}) role ${role.name} (${roleId}):`,e.message);
  return false;
 }
}
async function syncEconomicRoles(member){
 if(!member||member.user?.bot)return;
 const g=member.guild.id,u=member.id;
 await acct(g,u);

 // Prisoners never receive Resident, Citizen, salary, tax, property, or business roles.
 // Seeing the prisoner role also records persistent prisoner status for rejoin protection.
 const hasPrisonerRole=member.roles.cache.has(PRISONER_ROLE_ID);
 const persistentPrisoner=await isPersistentPrisoner(g,u);
 if(hasPrisonerRole||persistentPrisoner){
  await enforcePrisonerRoles(member,hasPrisonerRole?"discord_prisoner_role":"persistent_rejoin");
  return;
 }

 // Every non-bot member is at least a Resident unless they are a Citizen.
 const citizenship=(await q(`SELECT citizen FROM economy_citizenship WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];
 const discordCitizen=member.roles.cache.has(AUTO_ROLES.CITIZEN);
 const isCitizen=!!citizenship?.citizen||discordCitizen;
 if(discordCitizen&&!citizenship?.citizen)await q(`INSERT INTO economy_citizenship(guild_id,user_id,citizen,obtained_at,source) VALUES($1,$2,TRUE,NOW(),'discord_role') ON CONFLICT(guild_id,user_id) DO UPDATE SET citizen=TRUE,obtained_at=COALESCE(economy_citizenship.obtained_at,NOW()),source='discord_role'`,[g,u]);
 await safeRoleSet(member,AUTO_ROLES.CITIZEN,isCitizen);
 await safeRoleSet(member,AUTO_ROLES.RESIDENT,!isCitizen);

 // Government/security pay roles are derived from the member's real TA position roles.
 const sovereign=hasAnyRole(member,ROLE_SYNC_MAP.sovereign);
 const security=hasAnyRole(member,ROLE_SYNC_MAP.security);
 const high=hasAnyRole(member,ROLE_SYNC_MAP.high);
 const med=!high&&hasAnyRole(member,ROLE_SYNC_MAP.medium);
 const low=!high&&!med&&hasAnyRole(member,ROLE_SYNC_MAP.low);

 await safeRoleSet(member,AUTO_ROLES.SOVEREIGN,sovereign);
 await safeRoleSet(member,AUTO_ROLES.HIGH_GOV,high);
 await safeRoleSet(member,AUTO_ROLES.MED_GOV,med);
 await safeRoleSet(member,AUTO_ROLES.LOW_GOV,low);
 await safeRoleSet(member,AUTO_ROLES.SECURITY,security);

 // Income Tax follows taxable salary roles. Property taxes are handled separately below.
 await safeRoleSet(member,AUTO_ROLES.INCOME_TAX,sovereign||high||med||low||security);

 // Property ownership/tax roles are based on property records, not manually assigned Discord roles.
 const props=(await q(`SELECT COALESCE(SUM(CASE WHEN market_value>0 THEN market_value ELSE purchase_price END),0) v,COUNT(*) n FROM economy_properties WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];
 const pv=+props.v;
 const pTier=pv>=40000?"large":pv>=15000?"medium":pv>0?"small":"none";
 await safeRoleSet(member,AUTO_ROLES.SMALL_PROPERTY,pTier==="small");
 await safeRoleSet(member,AUTO_ROLES.MED_PROPERTY,pTier==="medium");
 await safeRoleSet(member,AUTO_ROLES.LARGE_PROPERTY,pTier==="large");
 await safeRoleSet(member,AUTO_ROLES.PROPERTY_TAX,pTier==="small"||pTier==="medium");
 await safeRoleSet(member,AUTO_ROLES.LARGE_PROPERTY_TAX,pTier==="large");

 // Business ownership roles are based on registered businesses.
 const businesses=(await q(`SELECT COUNT(*) n,COALESCE(SUM(valuation),0) v FROM economy_businesses WHERE guild_id=$1 AND owner_id=$2`,[g,u])).rows[0];
 const major=+businesses.v>=50000,owner=+businesses.n>0;
 await safeRoleSet(member,AUTO_ROLES.MAJOR_BUSINESS,major);
 await safeRoleSet(member,AUTO_ROLES.BUSINESS,owner&&!major);
}
async function syncFreshMember(guild,userId){
 const member=await guild.members.fetch(userId).catch(()=>null);
 if(member&&!member.user.bot)await syncEconomicRoles(member);
}
async function fullRoleAudit(){
 try{
  const guild=client.guilds.cache.get(GUILD_ID)||await client.guilds.fetch(GUILD_ID);
  const members=await guild.members.fetch();
  let checked=0;
  for(const member of members.values()){
   if(member.user.bot)continue;
   await syncEconomicRoles(member);
   checked++;
  }
  console.log(`[ROLE SYNC] Full audit complete: ${checked} non-bot members checked.`);
 }catch(e){console.error("[ROLE SYNC] Full audit failed:",e);}
}
function creditBand(score){
 if(score>=800)return "Exceptional";
 if(score>=740)return "Very Good";
 if(score>=670)return "Good";
 if(score>=580)return "Fair";
 return "Developing";
}
async function ensureCredit(g,u){
 await q(`INSERT INTO economy_credit(guild_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[g,u]);
 return (await q(`SELECT * FROM economy_credit WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];
}
async function recalcCredit(g,u){
 const c=await ensureCredit(g,u);
 const debt=(await q(`SELECT COALESCE(SUM(balance),0) debt FROM economy_loans WHERE guild_id=$1 AND user_id=$2 AND status='active'`,[g,u])).rows[0].debt;
 const a=await acct(g,u),assets=+a.wallet + +a.bank;
 let score=650+(+c.on_time_payments*6)-(+c.late_payments*35);
 if(+debt===0&&+c.total_borrowed>0)score+=25;
 if(+debt>Math.max(1000,assets*2))score-=35;
 score=Math.max(300,Math.min(850,Math.round(score)));
 await q(`UPDATE economy_credit SET score=$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,score]);
 return {...c,score,debt};
}
async function loanPaymentLoop(){
 try{
  const loans=(await q(`SELECT * FROM economy_loans WHERE status='active' AND next_payment<=NOW()`)).rows;
  for(const l of loans){
   const due=Math.min(+l.payment_amount,+l.balance),a=await acct(l.guild_id,l.user_id);
   if(+a.bank>=due){
    await q(`UPDATE economy_accounts SET bank=bank-$3 WHERE guild_id=$1 AND user_id=$2`,[l.guild_id,l.user_id,due]);
    const left=Math.max(0,+l.balance-due);
    await q(`UPDATE economy_loans SET balance=$2,next_payment=NOW()+INTERVAL '1 day',status=CASE WHEN $2<=0 THEN 'paid' ELSE 'active' END WHERE id=$1`,[l.id,left]);
    await q(`UPDATE economy_credit SET on_time_payments=on_time_payments+1,total_repaid=total_repaid+$3 WHERE guild_id=$1 AND user_id=$2`,[l.guild_id,l.user_id,due]);
    await q(`UPDATE economy_treasury SET balance=balance+$2 WHERE guild_id=$1`,[l.guild_id,Math.max(0,due-Math.floor(+l.principal/Math.max(1,+l.term_days)))]);
   }else{
    const fee=Math.max(10,Math.floor(due*.05));
    await q(`UPDATE economy_loans SET balance=balance+$2,late_count=late_count+1,next_payment=NOW()+INTERVAL '1 day' WHERE id=$1`,[l.id,fee]);
    await q(`UPDATE economy_credit SET late_payments=late_payments+1 WHERE guild_id=$1 AND user_id=$2`,[l.guild_id,l.user_id]);
   }
   await recalcCredit(l.guild_id,l.user_id);
  }
 }catch(e){console.error("Loan payments:",e);}
}
async function fiscalPolicy(g){
 let p=(await q(`SELECT * FROM economy_fiscal_policy WHERE guild_id=$1`,[g])).rows[0];
 if(!p){await q(`INSERT INTO economy_fiscal_policy(guild_id) VALUES($1) ON CONFLICT DO NOTHING`,[g]);p=(await q(`SELECT * FROM economy_fiscal_policy WHERE guild_id=$1`,[g])).rows[0];}
 return p;
}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
async function automaticFiscalPolicyLoop(){
 try{
  const g=GUILD_ID,c=marketClock(),pol=await fiscalPolicy(g);
  if(!pol.auto_mode||pol.last_auto_date===c.date)return;
  const x=await saveNationalStats(g);
  const set=(await q(`SELECT * FROM economy_settings WHERE guild_id=$1`,[g])).rows[0];
  const treasury=(await q(`SELECT balance FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0]||{balance:0};
  let income=+set.income_tax,property=+set.property_tax,large=+set.large_property_tax,sales=+pol.sales_tax,business=+pol.business_tax;
  const reasons=[];
  if(x.inflation>8){income+=1;sales+=.75;business+=.5;reasons.push('high inflation');}
  else if(x.inflation>5){income+=.5;sales+=.25;reasons.push('inflation pressure');}
  else if(x.inflation<0){income-=.5;sales-=.25;business-=.25;reasons.push('deflation support');}
  if(x.activity<-2){income-=.5;business-=.5;reasons.push('economic slowdown relief');}
  else if(x.activity>5&&x.inflation>3){business+=.25;reasons.push('strong demand');}
  if(+treasury.balance<Math.max(1000,x.money*.02)){income+=.25;business+=.25;reasons.push('treasury stabilization');}
  income=clamp(income,5,25);property=clamp(property+(x.inflation>7?.25:x.inflation<0?-.25:0),1,12);large=clamp(large+(x.inflation>7?.5:x.inflation<0?-.5:0),3,20);sales=clamp(sales,0,12);business=clamp(business,2,20);
  // Accelerated simulation: one bot day acts roughly like one economic month, capped to prevent price shocks.
  const dailyIndex=clamp(x.inflation/100/30,-.01,.01),newCpi=clamp(+pol.cpi*(1+dailyIndex),50,300);
  await q(`UPDATE economy_settings SET income_tax=$2,property_tax=$3,large_property_tax=$4 WHERE guild_id=$1`,[g,income,property,large]);
  await q(`UPDATE economy_fiscal_policy SET sales_tax=$2,business_tax=$3,cpi=$4,last_auto_date=$5,last_reason=$6,updated_at=NOW() WHERE guild_id=$1`,[g,sales,business,newCpi,c.date,reasons.join(', ')||'stable conditions']);
  await q(`UPDATE economy_shop SET price=GREATEST(1,ROUND(base_price*($2/100.0))) WHERE guild_id=$1 AND base_price IS NOT NULL`,[g,newCpi]);
  await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id) VALUES($1,'policy','Automatic Fiscal Policy',0,$2,'SYSTEM')`,[g,`CPI ${newCpi.toFixed(2)}; income ${income.toFixed(2)}%; sales ${sales.toFixed(2)}%; business ${business.toFixed(2)}%; ${reasons.join(', ')||'stable conditions'}`]);
  console.log(`[FISCAL] ${c.date} CPI=${newCpi.toFixed(2)} income=${income.toFixed(2)} sales=${sales.toFixed(2)} business=${business.toFixed(2)}`);
 }catch(e){console.error('Automatic fiscal policy:',e);}
}
async function budgetEmbed(g){
 const t=(await q(`SELECT * FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0]||{balance:0,tax_revenue:0,expenses:0};
 const gov=(await q(`SELECT * FROM economy_government WHERE guild_id=$1`,[g])).rows[0]||{};
 const p=await fiscalPolicy(g),set=(await q(`SELECT * FROM economy_settings WHERE guild_id=$1`,[g])).rows[0]||{};
 const rows=(await q(`SELECT * FROM economy_budget_allocations WHERE guild_id=$1 AND active=TRUE ORDER BY priority DESC,category`,[g])).rows;
 const base=Math.max(0,+t.balance),authorized=Math.max(0,+gov.budget_spending_limit||0),allocBase=authorized>0?Math.min(base,authorized):base;
 const alloc=rows.map(r=>`**${r.category}** — ${(+r.percent).toFixed(0)}% • ${rm(Math.floor(allocBase*(+r.percent/100)))}`).join('\n');
 return new EmbedBuilder().setTitle('📑 INTERIM NATIONAL BUDGET').setDescription('Automatic provisional budget in force until Congress adopts a replacement. The government begins with a one-time RM 5,000,000 treasury capitalization. Allocations automatically recalculate from currently available appropriable treasury funds; spending and tax collections stay synchronized with the same treasury.')
  .addFields(
   {name:'Treasury',value:`Available balance **${rm(base)}**\nBudget authority **${rm(authorized)}**\nAppropriable now **${rm(allocBase)}**\nTax revenue **${rm(+t.tax_revenue)}**\nRecorded expenses **${rm(+t.expenses)}**`,inline:true},
   {name:'Fiscal Policy',value:`Income tax **${(+set.income_tax||0).toFixed(2)}%**\nSales tax **${(+p.sales_tax).toFixed(2)}%**\nBusiness tax **${(+p.business_tax).toFixed(2)}%**\nCPI **${(+p.cpi).toFixed(2)}**`,inline:true},
   {name:'Government',value:`Debt **${rm(+gov.debt||0)}**\nDebt limit **${rm(+gov.debt_limit||0)}**\nBase interest **${(+gov.interest_rate||0).toFixed(2)}%**`,inline:true},
   {name:'Current Allocations',value:alloc||'No allocations configured.',inline:false},
   {name:'Automatic Stabilizers',value:'Taxes can move gradually with inflation, activity, and treasury stress. Shop prices are CPI-indexed daily. Property and business markets continue reacting to economic events.',inline:false}
  ).setFooter({text:'Interim automatic fiscal framework • Replaceable by future Congress'}).setTimestamp();
}
const ECON_EVENTS=[
 ["Construction Boom","Major construction activity raises demand across property and business markets.","boom",1.8,.3,3.5,2.0],
 ["Strong Consumer Spending","Household spending rises and businesses report stronger sales.","consumer",2.2,.8,1.0,3.0],
 ["Energy Shortage","Energy constraints raise costs and slow business activity.","energy",-2.0,2.2,-.5,-2.5],
 ["Housing Boom","Demand for housing and land rises sharply.","housing",1.2,1.0,5.0,1.0],
 ["Banking Expansion","Reichsbank credit and savings activity expands.","banking",1.5,.2,1.0,1.8],
 ["Economic Slowdown","Spending and business activity soften across the economy.","slowdown",-3.0,-.5,-2.5,-3.0],
 ["Industrial Expansion","Manufacturing and transport activity strengthen.","industry",2.5,.5,1.0,3.5],
 ["Price Pressure","Broad price increases push the inflation indicator higher.","inflation",-1.0,3.0,1.5,-1.0]
];
async function autoEconomicEventLoop(){
 try{
  if(!marketIsOpen())return;
  const c=marketClock(),key=`econ_event_${c.date}_${Math.floor(c.hour/3)}`;
  const seen=(await q(`SELECT value FROM economy_runtime_state WHERE guild_id=$1 AND key=$2`,[GUILD_ID,key])).rows[0];
  if(seen||Math.random()>.12)return;
  const e=ECON_EVENTS[Math.floor(Math.random()*ECON_EVENTS.length)];
  await q(`INSERT INTO economy_economic_events(guild_id,title,description,event_type,activity_impact,inflation_impact,property_impact,business_impact,expires_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()+INTERVAL '6 hours')`,[GUILD_ID,...e]);
  await q(`INSERT INTO economy_runtime_state(guild_id,key,value) VALUES($1,$2,'posted') ON CONFLICT DO NOTHING`,[GUILD_ID,key]);
  const set=(await q(`SELECT news_channel_id FROM economy_market_settings WHERE guild_id=$1`,[GUILD_ID])).rows[0];
  const ch=set?.news_channel_id?await client.channels.fetch(set.news_channel_id).catch(()=>null):null;
  if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder().setTitle(`🌐 ECONOMIC NEWS NETWORK • ${e[0]}`).setDescription(e[1]).addFields(
   {name:"Activity",value:`${e[3]>=0?"+":""}${e[3]} impact`,inline:true},
   {name:"Inflation",value:`${e[4]>=0?"+":""}${e[4]} impact`,inline:true},
   {name:"Property",value:`${e[5]>=0?"+":""}${e[5]}% pressure`,inline:true},
   {name:"Business",value:`${e[6]>=0?"+":""}${e[6]}% pressure`,inline:true}
  ).setFooter({text:"Automatically generated fictional TA economic event"}).setTimestamp()]});
 }catch(e){console.error("Economic event:",e);}
}
async function propertyBusinessTick(){
 try{
  const ev=(await q(`SELECT COALESCE(SUM(property_impact),0) p,COALESCE(SUM(business_impact),0) b FROM economy_economic_events WHERE guild_id=$1 AND active=TRUE AND expires_at>NOW()`,[GUILD_ID])).rows[0];
  const props=(await q(`SELECT p.*,COALESCE(s.price,0) base FROM economy_properties p LEFT JOIN economy_shop s ON s.id=p.item_id WHERE p.guild_id=$1`,[GUILD_ID])).rows;
  for(const p of props){
   const base=+p.market_value||+p.base||1000,move=(Math.random()-.5)*.02+(+ev.p/100/24),val=Math.max(100,Math.round(base*(1+move)));
   const rent=Math.max(0,Math.floor(val*.0005));
   await q(`UPDATE economy_properties SET market_value=$2,rent_income=rent_income+$3,last_property_tick=NOW() WHERE id=$1`,[p.id,val,rent]);
   if(rent)await give(p.guild_id,p.user_id,rent);
  }
  const biz=(await q(`SELECT * FROM economy_businesses WHERE guild_id=$1`,[GUILD_ID])).rows;
  for(const b of biz){
   const gross=Math.max(0,Math.floor((+b.valuation*.0025)*(1+(+ev.b/100))*(.75+Math.random()*.5)));
   const payroll=(await q(`SELECT COALESCE(SUM(wage),0) w FROM economy_business_employees WHERE business_id=$1`,[b.id])).rows[0].w;
   const fp=await fiscalPolicy(b.guild_id),tax=Math.max(0,Math.floor(gross*(+fp.business_tax/100))),net=Math.max(0,gross-(+payroll)-tax);
   await q(`UPDATE economy_businesses SET balance=balance+$2,revenue=revenue+$3,expenses=expenses+$4,valuation=GREATEST(1000,valuation+$5) WHERE id=$1`,[b.id,net,gross,(+payroll)+tax,Math.floor((gross-(+payroll)-tax)*0.15)]);
   if(tax){await q(`UPDATE economy_treasury SET balance=balance+$2,tax_revenue=tax_revenue+$2 WHERE guild_id=$1`,[b.guild_id,tax]);await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id) VALUES($1,'tax','Business Tax',$2,$3,'SYSTEM')`,[b.guild_id,tax,`Automatic business tax • ${b.name}`]);}
  }
  await q(`UPDATE economy_economic_events SET active=FALSE WHERE active=TRUE AND expires_at<=NOW()`);
 }catch(e){console.error("Property/business tick:",e);}
}
async function processLimitOrders(){
 try{
  if(!marketIsOpen())return;
  const orders=(await q(`SELECT o.*,s.price,s.symbol FROM economy_limit_orders o JOIN economy_stocks s ON s.id=o.stock_id WHERE o.status='open' ORDER BY o.created_at LIMIT 100`)).rows;
  for(const o of orders){
   const executable=o.side==="buy"?+o.price<=+o.limit_price:+o.price>=+o.limit_price;
   if(!executable)continue;
   const shares=+o.remaining,cost=Math.round(+o.price*shares);
   if(o.side==="buy"){
    const a=await acct(o.guild_id,o.user_id);if(+a.wallet<cost)continue;
    const s=(await q(`SELECT available_supply FROM economy_stocks WHERE id=$1`,[o.stock_id])).rows[0];if(+s.available_supply<shares)continue;
    await take(o.guild_id,o.user_id,cost);
    const h=(await q(`SELECT shares,avg_cost FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[o.guild_id,o.user_id,o.stock_id])).rows[0];
    const os=+(h?.shares||0),oa=+(h?.avg_cost||0),ns=os+shares,na=((os*oa)+cost)/ns;
    await q(`INSERT INTO economy_stock_holdings(guild_id,user_id,stock_id,shares,avg_cost) VALUES($1,$2,$3,$4,$5) ON CONFLICT(guild_id,user_id,stock_id) DO UPDATE SET shares=$4,avg_cost=$5`,[o.guild_id,o.user_id,o.stock_id,ns,na]);
    await q(`UPDATE economy_stocks SET available_supply=available_supply-$2,volume_24h=volume_24h+$2 WHERE id=$1`,[o.stock_id,shares]);
   }else{
    const h=(await q(`SELECT shares FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[o.guild_id,o.user_id,o.stock_id])).rows[0];if(!h||+h.shares<shares)continue;
    await q(`UPDATE economy_stock_holdings SET shares=shares-$4 WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[o.guild_id,o.user_id,o.stock_id,shares]);
    await give(o.guild_id,o.user_id,cost);await q(`UPDATE economy_stocks SET available_supply=LEAST(supply,available_supply+$2),volume_24h=volume_24h+$2 WHERE id=$1`,[o.stock_id,shares]);
   }
   await q(`UPDATE economy_limit_orders SET remaining=0,status='filled',filled_at=NOW() WHERE id=$1`,[o.id]);
   await tx(o.guild_id,o.side==="buy"?o.user_id:null,o.side==="sell"?o.user_id:null,cost,`limit_${o.side}`,`${shares} ${o.symbol}`);
  }
 }catch(e){console.error("Limit orders:",e);}
}
async function payDividends(g){
 const stocks=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND active=TRUE`,[g])).rows;
 let paid=0;
 for(const s of stocks){
  const per=Math.max(1,Math.round(+s.price*.005));
  const hs=(await q(`SELECT * FROM economy_stock_holdings WHERE guild_id=$1 AND stock_id=$2 AND shares>0`,[g,s.id])).rows;
  let total=0;for(const h of hs){const amt=Math.round(+h.shares*per);await give(g,h.user_id,amt);total+=amt;}
  if(total){await q(`INSERT INTO economy_dividends(guild_id,stock_id,amount_per_share,total_paid) VALUES($1,$2,$3,$4)`,[g,s.id,per,total]);paid+=total;}
 }
 return paid;
}
const AUTO_MARKET_EVENTS=[
 {title:"Manufacturing Orders Accelerate",details:"Manufacturers report a sharp increase in new orders, prompting firms to extend production schedules and secure additional raw materials.",min:2.1,max:5.23,kind:"great",category:"Industry"},
 {title:"Manufacturing Orders Accelerate \u2014 Market Update",details:"Manufacturers report a sharp increase in new orders, prompting firms to extend production schedules and secure additional raw materials. Analysts are watching the next reporting period for confirmation of the trend.",min:3.19,max:2.5,kind:"great",category:"Industry"},
 {title:"Factory Expansion Program Announced",details:"A major producer has approved additional production capacity after stronger-than-expected demand across domestic markets.",min:1.5,max:1.54,kind:"positive",category:"Industry"},
 {title:"Factory Expansion Program Announced \u2014 Market Update",details:"A major producer has approved additional production capacity after stronger-than-expected demand across domestic markets. Analysts are watching the next reporting period for confirmation of the trend.",min:1.72,max:1.53,kind:"positive",category:"Industry"},
 {title:"Industrial Output Holds Steady",details:"Production remained broadly stable as stronger machinery demand offset softer orders elsewhere.",min:-0.28,max:0.22,kind:"mixed",category:"Industry"},
 {title:"Industrial Output Holds Steady \u2014 Market Update",details:"Production remained broadly stable as stronger machinery demand offset softer orders elsewhere. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Industry"},
 {title:"Input Costs Pressure Manufacturers",details:"Rising material and transportation costs are squeezing margins and forcing producers to review spending plans.",min:-1.47,max:-1.21,kind:"negative",category:"Industry"},
 {title:"Input Costs Pressure Manufacturers \u2014 Market Update",details:"Rising material and transportation costs are squeezing margins and forcing producers to review spending plans. Analysts are watching the next reporting period for confirmation of the trend.",min:-1.06,max:-1.73,kind:"negative",category:"Industry"},
 {title:"Major Production Disruption",details:"A serious production interruption has reduced available output and raised concerns about delayed deliveries across several industries.",min:-4.6,max:-5.09,kind:"horrible",category:"Industry"},
 {title:"Major Production Disruption \u2014 Market Update",details:"A serious production interruption has reduced available output and raised concerns about delayed deliveries across several industries. Analysts are watching the next reporting period for confirmation of the trend.",min:-5.39,max:-6.51,kind:"horrible",category:"Industry"},
 {title:"Credit Conditions Improve",details:"Banks report stronger deposit growth and improved loan performance, giving lenders more room to support households and expanding businesses.",min:3.19,max:3.16,kind:"great",category:"Banking"},
 {title:"Credit Conditions Improve \u2014 Market Update",details:"Banks report stronger deposit growth and improved loan performance, giving lenders more room to support households and expanding businesses. Analysts are watching the next reporting period for confirmation of the trend.",min:2.88,max:3.78,kind:"great",category:"Banking"},
 {title:"Lending Activity Strengthens",details:"Commercial lending increased as businesses sought financing for expansion, equipment purchases, and working-capital needs.",min:1.84,max:0.67,kind:"positive",category:"Banking"},
 {title:"Lending Activity Strengthens \u2014 Market Update",details:"Commercial lending increased as businesses sought financing for expansion, equipment purchases, and working-capital needs. Analysts are watching the next reporting period for confirmation of the trend.",min:1.41,max:0.66,kind:"positive",category:"Banking"},
 {title:"Banks Maintain Cautious Lending",details:"Financial institutions kept lending standards largely unchanged while monitoring inflation, debt, and business conditions.",min:-0.28,max:0.22,kind:"mixed",category:"Banking"},
 {title:"Banks Maintain Cautious Lending \u2014 Market Update",details:"Financial institutions kept lending standards largely unchanged while monitoring inflation, debt, and business conditions. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Banking"},
 {title:"Loan Delinquencies Rise",details:"Banks are reporting more late payments, leading lenders to tighten underwriting and reassess new credit applications.",min:-1.08,max:-2.17,kind:"negative",category:"Banking"},
 {title:"Loan Delinquencies Rise \u2014 Market Update",details:"Banks are reporting more late payments, leading lenders to tighten underwriting and reassess new credit applications. Analysts are watching the next reporting period for confirmation of the trend.",min:-2.35,max:-2.54,kind:"negative",category:"Banking"},
 {title:"Financial System Faces Severe Stress",details:"A sudden deterioration in liquidity has forced banks to preserve cash and sharply restrict new lending while markets assess the wider impact.",min:-6.15,max:-4.66,kind:"horrible",category:"Banking"},
 {title:"Financial System Faces Severe Stress \u2014 Market Update",details:"A sudden deterioration in liquidity has forced banks to preserve cash and sharply restrict new lending while markets assess the wider impact. Analysts are watching the next reporting period for confirmation of the trend.",min:-3.23,max:-5.28,kind:"horrible",category:"Banking"},
 {title:"National Infrastructure Expansion",details:"New transportation and public-works projects are moving into construction, increasing demand for contractors, materials, and industrial equipment.",min:3.09,max:2.64,kind:"great",category:"Infrastructure"},
 {title:"National Infrastructure Expansion \u2014 Market Update",details:"New transportation and public-works projects are moving into construction, increasing demand for contractors, materials, and industrial equipment. Analysts are watching the next reporting period for confirmation of the trend.",min:2.42,max:4.94,kind:"great",category:"Infrastructure"},
 {title:"Major Project Completed Ahead of Schedule",details:"A large infrastructure project entered service earlier than expected, improving capacity and reducing transportation bottlenecks.",min:0.67,max:0.74,kind:"positive",category:"Infrastructure"},
 {title:"Major Project Completed Ahead of Schedule \u2014 Market Update",details:"A large infrastructure project entered service earlier than expected, improving capacity and reducing transportation bottlenecks. Analysts are watching the next reporting period for confirmation of the trend.",min:1.95,max:1.36,kind:"positive",category:"Infrastructure"},
 {title:"Construction Program Advances",details:"Public works remain on schedule, supporting steady demand for construction labor, machinery, and building materials.",min:-0.28,max:0.22,kind:"mixed",category:"Infrastructure"},
 {title:"Construction Program Advances \u2014 Market Update",details:"Public works remain on schedule, supporting steady demand for construction labor, machinery, and building materials. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Infrastructure"},
 {title:"Infrastructure Project Delayed",details:"Construction and procurement issues have pushed back completion dates and increased projected project costs.",min:-2.3,max:-0.97,kind:"negative",category:"Infrastructure"},
 {title:"Infrastructure Project Delayed \u2014 Market Update",details:"Construction and procurement issues have pushed back completion dates and increased projected project costs. Analysts are watching the next reporting period for confirmation of the trend.",min:-1.27,max:-1.11,kind:"negative",category:"Infrastructure"},
 {title:"Critical Infrastructure Failure",details:"A major infrastructure failure has disrupted commercial activity and transportation, creating immediate repair costs and supply-chain delays.",min:-4.71,max:-4.16,kind:"horrible",category:"Infrastructure"},
 {title:"Critical Infrastructure Failure \u2014 Market Update",details:"A major infrastructure failure has disrupted commercial activity and transportation, creating immediate repair costs and supply-chain delays. Analysts are watching the next reporting period for confirmation of the trend.",min:-4.29,max:-4.07,kind:"horrible",category:"Infrastructure"},
 {title:"Technology Investment Surges",details:"Companies are increasing spending on computing, communications, and automation as demand for digital services strengthens.",min:3.75,max:4.6,kind:"great",category:"Technology"},
 {title:"Technology Investment Surges \u2014 Market Update",details:"Companies are increasing spending on computing, communications, and automation as demand for digital services strengthens. Analysts are watching the next reporting period for confirmation of the trend.",min:5.28,max:3.85,kind:"great",category:"Technology"},
 {title:"Major Technology Contract Awarded",details:"A large technology contract is expected to generate new revenue, hiring, and equipment investment over the coming months.",min:1.66,max:1.07,kind:"positive",category:"Technology"},
 {title:"Major Technology Contract Awarded \u2014 Market Update",details:"A large technology contract is expected to generate new revenue, hiring, and equipment investment over the coming months. Analysts are watching the next reporting period for confirmation of the trend.",min:0.77,max:0.63,kind:"positive",category:"Technology"},
 {title:"Technology Sector Consolidates",details:"Technology firms are balancing new investment with cost controls as demand remains stable across major services.",min:-0.28,max:0.22,kind:"mixed",category:"Technology"},
 {title:"Technology Sector Consolidates \u2014 Market Update",details:"Technology firms are balancing new investment with cost controls as demand remains stable across major services. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Technology"},
 {title:"Technology Project Misses Targets",details:"A delayed rollout and higher development costs have weakened expectations for near-term technology-sector earnings.",min:-2.41,max:-1.87,kind:"negative",category:"Technology"},
 {title:"Technology Project Misses Targets \u2014 Market Update",details:"A delayed rollout and higher development costs have weakened expectations for near-term technology-sector earnings. Analysts are watching the next reporting period for confirmation of the trend.",min:-1.77,max:-2.25,kind:"negative",category:"Technology"},
 {title:"Major Systems Outage Hits Commerce",details:"A widespread technology failure has interrupted business operations and communications, raising concerns about lost revenue and recovery costs.",min:-5.69,max:-5.2,kind:"horrible",category:"Technology"},
 {title:"Major Systems Outage Hits Commerce \u2014 Market Update",details:"A widespread technology failure has interrupted business operations and communications, raising concerns about lost revenue and recovery costs. Analysts are watching the next reporting period for confirmation of the trend.",min:-3.26,max:-4.48,kind:"horrible",category:"Technology"},
 {title:"Trade Agreement Opens New Markets",details:"A new commercial agreement reduces barriers for exporters and is expected to increase cross-border orders and investment.",min:4.41,max:4.91,kind:"great",category:"Trade"},
 {title:"Trade Agreement Opens New Markets \u2014 Market Update",details:"A new commercial agreement reduces barriers for exporters and is expected to increase cross-border orders and investment. Analysts are watching the next reporting period for confirmation of the trend.",min:4.93,max:3.37,kind:"great",category:"Trade"},
 {title:"Exports Post Strong Gains",details:"Export demand strengthened as foreign buyers increased orders for Authority-produced goods and services.",min:2.39,max:2.18,kind:"positive",category:"Trade"},
 {title:"Exports Post Strong Gains \u2014 Market Update",details:"Export demand strengthened as foreign buyers increased orders for Authority-produced goods and services. Analysts are watching the next reporting period for confirmation of the trend.",min:1.79,max:2.36,kind:"positive",category:"Trade"},
 {title:"Trade Flows Remain Balanced",details:"Imports and exports showed limited movement, leaving the broader trade outlook largely unchanged.",min:-0.28,max:0.22,kind:"mixed",category:"Trade"},
 {title:"Trade Flows Remain Balanced \u2014 Market Update",details:"Imports and exports showed limited movement, leaving the broader trade outlook largely unchanged. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Trade"},
 {title:"Trade Dispute Raises Costs",details:"New restrictions and retaliatory measures are increasing costs for importers and exporters while clouding the outlook for trade-sensitive firms.",min:-0.99,max:-2.41,kind:"negative",category:"Trade"},
 {title:"Trade Dispute Raises Costs \u2014 Market Update",details:"New restrictions and retaliatory measures are increasing costs for importers and exporters while clouding the outlook for trade-sensitive firms. Analysts are watching the next reporting period for confirmation of the trend.",min:-2.2,max:-0.86,kind:"negative",category:"Trade"},
 {title:"Major Trade Routes Disrupted",details:"Severe disruption to key trade routes is delaying shipments, reducing available supplies, and placing upward pressure on prices.",min:-3.26,max:-6.88,kind:"horrible",category:"Trade"},
 {title:"Major Trade Routes Disrupted \u2014 Market Update",details:"Severe disruption to key trade routes is delaying shipments, reducing available supplies, and placing upward pressure on prices. Analysts are watching the next reporting period for confirmation of the trend.",min:-4.35,max:-3.48,kind:"horrible",category:"Trade"},
 {title:"Consumer Spending Surges",details:"Household spending strengthened across retail and services, giving businesses greater confidence in near-term demand.",min:2.08,max:2.73,kind:"great",category:"Consumer"},
 {title:"Consumer Spending Surges \u2014 Market Update",details:"Household spending strengthened across retail and services, giving businesses greater confidence in near-term demand. Analysts are watching the next reporting period for confirmation of the trend.",min:2.03,max:3.11,kind:"great",category:"Consumer"},
 {title:"Retail Sales Beat Expectations",details:"Retail activity exceeded expectations as consumers increased purchases across several major categories.",min:0.98,max:1.91,kind:"positive",category:"Consumer"},
 {title:"Retail Sales Beat Expectations \u2014 Market Update",details:"Retail activity exceeded expectations as consumers increased purchases across several major categories. Analysts are watching the next reporting period for confirmation of the trend.",min:1.01,max:2.24,kind:"positive",category:"Consumer"},
 {title:"Household Demand Remains Stable",details:"Consumer activity held near recent levels as stronger spending in some areas offset weakness in others.",min:-0.28,max:0.22,kind:"mixed",category:"Consumer"},
 {title:"Household Demand Remains Stable \u2014 Market Update",details:"Consumer activity held near recent levels as stronger spending in some areas offset weakness in others. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Consumer"},
 {title:"Consumer Confidence Weakens",details:"Households are becoming more cautious about major purchases as prices and borrowing costs weigh on disposable income.",min:-2.51,max:-1.12,kind:"negative",category:"Consumer"},
 {title:"Consumer Confidence Weakens \u2014 Market Update",details:"Households are becoming more cautious about major purchases as prices and borrowing costs weigh on disposable income. Analysts are watching the next reporting period for confirmation of the trend.",min:-0.84,max:-0.76,kind:"negative",category:"Consumer"},
 {title:"Household Spending Contracts Sharply",details:"A sudden pullback in consumer spending has hit retailers and service businesses, raising concerns about a broader economic slowdown.",min:-5.15,max:-5.57,kind:"horrible",category:"Consumer"},
 {title:"Household Spending Contracts Sharply \u2014 Market Update",details:"A sudden pullback in consumer spending has hit retailers and service businesses, raising concerns about a broader economic slowdown. Analysts are watching the next reporting period for confirmation of the trend.",min:-6.55,max:-5.35,kind:"horrible",category:"Consumer"},
 {title:"Property Market Expansion Accelerates",details:"Demand for residential and commercial property increased, supporting construction activity and higher transaction volumes.",min:4.41,max:3.73,kind:"great",category:"Property"},
 {title:"Property Market Expansion Accelerates \u2014 Market Update",details:"Demand for residential and commercial property increased, supporting construction activity and higher transaction volumes. Analysts are watching the next reporting period for confirmation of the trend.",min:4.62,max:3.95,kind:"great",category:"Property"},
 {title:"Development Activity Strengthens",details:"New property projects and renovations are increasing as developers respond to stronger occupancy and buyer demand.",min:1.9,max:2.3,kind:"positive",category:"Property"},
 {title:"Development Activity Strengthens \u2014 Market Update",details:"New property projects and renovations are increasing as developers respond to stronger occupancy and buyer demand. Analysts are watching the next reporting period for confirmation of the trend.",min:0.62,max:0.8,kind:"positive",category:"Property"},
 {title:"Property Market Remains Balanced",details:"Prices and transaction activity remained broadly stable as supply and demand stayed closely matched.",min:-0.28,max:0.22,kind:"mixed",category:"Property"},
 {title:"Property Market Remains Balanced \u2014 Market Update",details:"Prices and transaction activity remained broadly stable as supply and demand stayed closely matched. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Property"},
 {title:"Property Demand Cools",details:"Higher financing costs and weaker buyer demand are slowing transactions and putting pressure on property values.",min:-1.47,max:-2.08,kind:"negative",category:"Property"},
 {title:"Property Demand Cools \u2014 Market Update",details:"Higher financing costs and weaker buyer demand are slowing transactions and putting pressure on property values. Analysts are watching the next reporting period for confirmation of the trend.",min:-0.91,max:-1.29,kind:"negative",category:"Property"},
 {title:"Property Market Suffers Severe Correction",details:"A sharp drop in demand has forced significant price reductions and increased financial pressure on owners and lenders.",min:-3.22,max:-4.54,kind:"horrible",category:"Property"},
 {title:"Property Market Suffers Severe Correction \u2014 Market Update",details:"A sharp drop in demand has forced significant price reductions and increased financial pressure on owners and lenders. Analysts are watching the next reporting period for confirmation of the trend.",min:-5.7,max:-3.66,kind:"horrible",category:"Property"},
 {title:"Hiring Boom Strengthens Labor Market",details:"Employers are expanding payrolls across several sectors as stronger demand encourages businesses to add workers and operating capacity.",min:2.21,max:4.35,kind:"great",category:"Employment"},
 {title:"Hiring Boom Strengthens Labor Market \u2014 Market Update",details:"Employers are expanding payrolls across several sectors as stronger demand encourages businesses to add workers and operating capacity. Analysts are watching the next reporting period for confirmation of the trend.",min:4.55,max:5.33,kind:"great",category:"Employment"},
 {title:"Businesses Announce New Hiring",details:"Companies have opened new positions to support expansion plans, increasing household income and spending potential.",min:2.19,max:1.3,kind:"positive",category:"Employment"},
 {title:"Businesses Announce New Hiring \u2014 Market Update",details:"Companies have opened new positions to support expansion plans, increasing household income and spending potential. Analysts are watching the next reporting period for confirmation of the trend.",min:2.05,max:1.39,kind:"positive",category:"Employment"},
 {title:"Labor Market Holds Steady",details:"Hiring and workforce reductions remained limited, leaving employment conditions broadly unchanged.",min:-0.28,max:0.22,kind:"mixed",category:"Employment"},
 {title:"Labor Market Holds Steady \u2014 Market Update",details:"Hiring and workforce reductions remained limited, leaving employment conditions broadly unchanged. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Employment"},
 {title:"Layoffs Increase Across Key Employers",details:"Several employers are reducing payrolls as weaker demand and higher operating costs force businesses to cut expenses.",min:-0.72,max:-2.54,kind:"negative",category:"Employment"},
 {title:"Layoffs Increase Across Key Employers \u2014 Market Update",details:"Several employers are reducing payrolls as weaker demand and higher operating costs force businesses to cut expenses. Analysts are watching the next reporting period for confirmation of the trend.",min:-1.97,max:-1.65,kind:"negative",category:"Employment"},
 {title:"Employment Shock Hits Economy",details:"Large-scale job losses have sharply weakened household income and confidence, increasing the risk of a broader economic contraction.",min:-6.08,max:-7.07,kind:"horrible",category:"Employment"},
 {title:"Employment Shock Hits Economy \u2014 Market Update",details:"Large-scale job losses have sharply weakened household income and confidence, increasing the risk of a broader economic contraction. Analysts are watching the next reporting period for confirmation of the trend.",min:-6.97,max:-4.09,kind:"horrible",category:"Employment"},
 {title:"Energy Supply Expansion Lowers Costs",details:"Additional energy capacity has improved supply conditions and reduced cost pressure for households and industrial users.",min:3.8,max:2.24,kind:"great",category:"Energy"},
 {title:"Energy Supply Expansion Lowers Costs \u2014 Market Update",details:"Additional energy capacity has improved supply conditions and reduced cost pressure for households and industrial users. Analysts are watching the next reporting period for confirmation of the trend.",min:2.45,max:3.91,kind:"great",category:"Energy"},
 {title:"Energy Production Beats Forecasts",details:"Output exceeded expectations, improving supply reliability and easing concerns about near-term energy availability.",min:1.48,max:1.55,kind:"positive",category:"Energy"},
 {title:"Energy Production Beats Forecasts \u2014 Market Update",details:"Output exceeded expectations, improving supply reliability and easing concerns about near-term energy availability. Analysts are watching the next reporting period for confirmation of the trend.",min:1.19,max:2.35,kind:"positive",category:"Energy"},
 {title:"Energy Market Remains Stable",details:"Supply and demand remained balanced, keeping energy costs within their recent range.",min:-0.28,max:0.22,kind:"mixed",category:"Energy"},
 {title:"Energy Market Remains Stable \u2014 Market Update",details:"Supply and demand remained balanced, keeping energy costs within their recent range. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Energy"},
 {title:"Energy Costs Rise on Supply Tightness",details:"Reduced supply has pushed energy costs higher, increasing operating expenses for businesses and transportation providers.",min:-0.72,max:-2.12,kind:"negative",category:"Energy"},
 {title:"Energy Costs Rise on Supply Tightness \u2014 Market Update",details:"Reduced supply has pushed energy costs higher, increasing operating expenses for businesses and transportation providers. Analysts are watching the next reporting period for confirmation of the trend.",min:-2.77,max:-2.22,kind:"negative",category:"Energy"},
 {title:"Severe Energy Shortage Disrupts Economy",details:"A major supply shortage has forced production cutbacks while sharply increasing energy costs.",min:-4.93,max:-4.46,kind:"horrible",category:"Energy"},
 {title:"Severe Energy Shortage Disrupts Economy \u2014 Market Update",details:"A major supply shortage has forced production cutbacks while sharply increasing energy costs. Analysts are watching the next reporting period for confirmation of the trend.",min:-3.61,max:-6.91,kind:"horrible",category:"Energy"},
 {title:"Economic Investment Program Expanded",details:"Government investment in economic development and public projects is supporting contractors, employment, and business activity.",min:3.71,max:5.03,kind:"great",category:"Government"},
 {title:"Economic Investment Program Expanded \u2014 Market Update",details:"Government investment in economic development and public projects is supporting contractors, employment, and business activity. Analysts are watching the next reporting period for confirmation of the trend.",min:5.26,max:2.95,kind:"great",category:"Government"},
 {title:"Government Contracts Boost Private Sector",details:"New contract awards are providing additional revenue to businesses and supporting hiring and capital investment.",min:1.41,max:1.64,kind:"positive",category:"Government"},
 {title:"Government Contracts Boost Private Sector \u2014 Market Update",details:"New contract awards are providing additional revenue to businesses and supporting hiring and capital investment. Analysts are watching the next reporting period for confirmation of the trend.",min:1.45,max:1.83,kind:"positive",category:"Government"},
 {title:"Fiscal Position Remains Stable",details:"Government revenue and spending remain close to current plans as officials monitor inflation, growth, and treasury conditions.",min:-0.28,max:0.22,kind:"mixed",category:"Government"},
 {title:"Fiscal Position Remains Stable \u2014 Market Update",details:"Government revenue and spending remain close to current plans as officials monitor inflation, growth, and treasury conditions. Analysts are watching the next reporting period for confirmation of the trend.",min:0.18,max:-0.18,kind:"mixed",category:"Government"},
 {title:"Budget Pressure Forces Spending Review",details:"Weaker revenue and rising costs are forcing officials to reassess planned spending and near-term fiscal priorities.",min:-0.72,max:-2.13,kind:"negative",category:"Government"},
 {title:"Budget Pressure Forces Spending Review \u2014 Market Update",details:"Weaker revenue and rising costs are forcing officials to reassess planned spending and near-term fiscal priorities. Analysts are watching the next reporting period for confirmation of the trend.",min:-1.01,max:-2.07,kind:"negative",category:"Government"},
 {title:"Fiscal Emergency Triggers Market Concern",details:"A severe deterioration in government finances has raised concerns about spending reductions, borrowing needs, and broader economic stability.",min:-3.73,max:-3.4,kind:"horrible",category:"Government"},
 {title:"Fiscal Emergency Triggers Market Concern \u2014 Market Update",details:"A severe deterioration in government finances has raised concerns about spending reductions, borrowing needs, and broader economic stability. Analysts are watching the next reporting period for confirmation of the trend.",min:-6.78,max:-3.21,kind:"horrible",category:"Government"}
];
function marketEventSeverity(impact){
 const n=Number(impact||0);
 if(n>=50)return {name:"HISTORIC BREAKOUT",emoji:"🚀"};
 if(n>=15)return {name:"EXPLOSIVE RALLY",emoji:"🚀"};
 if(n<=-50)return {name:"MARKET PANIC",emoji:"🔴"};
 if(n<=-15)return {name:"CRASH WARNING",emoji:"🔴"};
 if(n>=1.8)return {name:"GREAT",emoji:"🌟"};
 if(n>=0.5)return {name:"GOOD",emoji:"🟢"};
 if(n>-0.5)return {name:"NEUTRAL / MIXED",emoji:"⚪"};
 if(n>-3)return {name:"BAD",emoji:"🟠"};
 return {name:"HORRIBLE / CRISIS",emoji:"🔴"};
}
function randomBetween(a,b){return a+Math.random()*(b-a);}
async function scheduleNextAutoEvent(g,minMinutes=5,maxMinutes=20){
 const mins=Math.floor(randomBetween(minMinutes,maxMinutes+1));
 const r=await q(`UPDATE economy_market_settings
   SET next_auto_event_at=NOW()+($2||' minutes')::interval
   WHERE guild_id=$1
   RETURNING next_auto_event_at`,[g,String(mins)]);
 const when=r.rows[0]?.next_auto_event_at;
 console.log(`[MARKET NEWS] Next automatic company bulletin scheduled in ${mins} minute(s)${when?` • ${new Date(when).toISOString()}`:""}.`);
 return {mins,when};
}
async function autoMarketEventLoop(){
 try{
  if(!marketIsOpen())return;
  const settings=(await q(`SELECT * FROM economy_market_settings`)).rows;
  for(const set of settings){
   if(!set.next_auto_event_at){await scheduleNextAutoEvent(set.guild_id,5,20);continue;}
   if(new Date(set.next_auto_event_at)>new Date())continue;
   const stocks=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND active=TRUE ORDER BY RANDOM() LIMIT 1`,[set.guild_id])).rows;
   if(!stocks.length){await scheduleNextAutoEvent(set.guild_id);continue;}
   const s=stocks[0];
   const roll=Math.random()*100;
   const desiredKind=roll<8?"horrible":roll<27?"great":roll<43?"negative":roll<82?"positive":"mixed";
   const pool=AUTO_MARKET_EVENTS.filter(x=>x.kind===desiredKind);
   const template=pool[Math.floor(Math.random()*pool.length)];
   let impact=randomBetween(Math.min(template.min,template.max),Math.max(template.min,template.max));
   // Rare, extreme fictional company news: >+100% surges or near-total crashes.
   const shock=crypto.randomInt(10000)/100;
   if(shock<4)impact=randomBetween(110,450);
   else if(shock<8)impact=-randomBetween(55,94);
   else if(shock<18)impact=impact>0?randomBetween(18,95):-randomBetween(15,65);
   impact=Math.round(impact*100)/100;
   const severity=marketEventSeverity(impact);
   const hours=Math.floor(randomBetween(2,7));
   await q(`INSERT INTO economy_market_events(guild_id,stock_id,title,description,impact_pct,expires_at,created_by)
    VALUES($1,$2,$3,$4,$5,NOW()+($6||' hours')::interval,'AUTO-MARKET-ENGINE')`,
    [set.guild_id,s.id,template.title,template.details,impact,String(hours)]);
   if(set.news_channel_id){
    const ch=await client.channels.fetch(set.news_channel_id).catch(e=>{console.error(`[MARKET NEWS] Could not fetch configured news channel ${set.news_channel_id}:`,e.message);return null;});
    if(ch?.isTextBased())await ch.send({embeds:[new EmbedBuilder()
      .setTitle(`${severity.emoji} ${severity.name} MARKET EVENT • ${s.symbol}`)
      .setDescription(`**${template.title}**\n${template.details}\n\nMarket sentiment: **${impact>0?"▲ Positive":impact<0?"▼ Negative":"◆ Mixed / Neutral"}**\nExpected influence: **${impact>=0?"+":""}${impact.toFixed(2)}%** over approximately **${hours}h**.`)
      .addFields(
       {name:"Company",value:`${s.name} (${s.symbol})`,inline:true},
       {name:"Current price",value:rm(s.price),inline:true},
       {name:"Severity",value:`${severity.emoji} **${severity.name}**`,inline:true},
       {name:"Category",value:template.category||"Market",inline:true},
       {name:"Market",value:marketStatusText(),inline:false})
      .setFooter({text:"Automatically generated Reichsmark market event • affects simulated market pressure • no real-money value"}).setTimestamp()]})
      .then(async()=>{
       console.log(`[MARKET NEWS] Posted automatic ${s.symbol} bulletin to channel ${set.news_channel_id}.`);
       await stockTick();
       console.log(`[MARKET NEWS] Applied immediate market tick after ${s.symbol} bulletin.`);
      })
      .catch(e=>console.error(`[MARKET NEWS] Failed to post automatic bulletin to ${set.news_channel_id}:`,e));
    else console.error(`[MARKET NEWS] Configured news channel ${set.news_channel_id} is missing or is not text-based.`);
   }else{
    console.error(`[MARKET NEWS] No news_channel_id is configured for guild ${set.guild_id}. Run /marketsetup.`);
   }
   await scheduleNextAutoEvent(set.guild_id,5,20);
  }
 }catch(e){console.error("Auto market event:",e);}
}
async function getDailyMarketRegime(g){
 const c=marketClock(),key=`market_regime_${c.date}`;
 const old=(await q(`SELECT value FROM economy_runtime_state WHERE guild_id=$1 AND key=$2`,[g,key])).rows[0];
 if(old?.value){try{return JSON.parse(old.value);}catch{}}
 // Fictional high-volatility market: growth-biased with spectacular rallies and crashes.
 // A daily target of -0.99 is the maximum possible loss; positive returns can exceed +100%.
 const roll=crypto.randomInt(10000)/100;
 let regime;
 if(roll<2) regime={name:"BLACK SWAN CRASH",emoji:"🔴",daily:-.97,vol:3.0,sentiment:2};
 else if(roll<8) regime={name:"MARKET MELTDOWN",emoji:"🔴",daily:-.62,vol:2.6,sentiment:8};
 else if(roll<18) regime={name:"BRUTAL SELLOFF",emoji:"🟠",daily:-.32,vol:2.1,sentiment:20};
 else if(roll<29) regime={name:"BEAR MARKET",emoji:"🟠",daily:-.12,vol:1.8,sentiment:35};
 else if(roll<40) regime={name:"CHOPPY / MIXED",emoji:"⚪",daily:.02,vol:1.8,sentiment:50};
 else if(roll<60) regime={name:"BULL MARKET",emoji:"🟢",daily:.18,vol:1.7,sentiment:72};
 else if(roll<78) regime={name:"MAJOR RALLY",emoji:"🟢",daily:.45,vol:2.1,sentiment:83};
 else if(roll<92) regime={name:"EXPLOSIVE BOOM",emoji:"🌟",daily:1.15,vol:2.5,sentiment:94};
 else if(roll<98) regime={name:"MARKET MANIA",emoji:"🚀",daily:3.8,vol:3.0,sentiment:98};
 else regime={name:"HISTORIC SUPERBOOM",emoji:"🚀",daily:8.5,vol:3.6,sentiment:100};
 regime.daily=Math.max(-.99,regime.daily*(.88+crypto.randomInt(2501)/10000));
 regime.createdAt=new Date().toISOString();
 await q(`INSERT INTO economy_runtime_state(guild_id,key,value) VALUES($1,$2,$3) ON CONFLICT(guild_id,key) DO UPDATE SET value=$3,updated_at=NOW()`,[g,key,JSON.stringify(regime)]);
 return regime;
}
function marketBar(score,width=20){const n=Math.max(0,Math.min(width,Math.round(score/100*width)));return `${"█".repeat(n)}${"░".repeat(width-n)}`;}
function clampMarket(v,min,max){return Math.max(min,Math.min(max,v));}
async function stockTick(){
 try{
  if(!marketIsOpen())return;
  await ensureMarketSession(GUILD_ID);
  const regime=await getDailyMarketRegime(GUILD_ID);
  const rows=(await q(`SELECT * FROM economy_stocks WHERE active=TRUE`)).rows;
  // Compounded daily target, distributed over 420 minute-long ticks.
  // Log returns make +100%, +300% and near-total crashes mathematically possible.
  const regimeMinute=Math.log1p(Math.max(-.99,regime.daily))/420;
  for(const s of rows){
   const vol=Math.max(.015,Math.min(.12,+s.volatility||.035));
   const noise=((crypto.randomInt(20001)-10000)/10000)*(vol/Math.sqrt(420))*regime.vol;
   const scarcity=s.supply>0?(1-(+(s.available_supply??s.supply)/+s.supply)):0;
   const scarcityPressure=Math.min(.0007,scarcity*.0005);
   const ev=(await q(`SELECT COALESCE(SUM(impact_pct),0) impact FROM economy_market_events WHERE guild_id=$1 AND stock_id=$2 AND active=TRUE AND expires_at>NOW()`,[s.guild_id,s.id])).rows[0];
   // Event impact is spread across roughly 2 hours of minute ticks.
   // Use logarithmic returns to support +100% and beyond without negative prices.
   const impactFraction=clampMarket((+ev.impact||0)/100,-.98,20);
   const eventPressure=clampMarket(Math.log1p(impactFraction)/120,-.06,.06);
   // Individual companies vary: high-beta stocks can soar or collapse faster than the index.
   const beta=.55+((Number(s.id)%151)/100);
   const logMove=clampMarket(regimeMinute*beta+noise+scarcityPressure+eventPressure,-.22,.22);
   const pct=Math.expm1(logMove);
   const next=Math.max(.01,Math.min(999999999999,Math.round(+s.price*(1+pct)*100)/100));
   await q(`UPDATE economy_stocks SET price=$2,last_update=NOW() WHERE id=$1`,[s.id,next]);
   await q(`INSERT INTO economy_stock_history(stock_id,price) VALUES($1,$2)`,[s.id,next]);
  }
  await q(`UPDATE economy_market_events SET active=FALSE WHERE active=TRUE AND expires_at<=NOW()`);
  await updateMarketSession(GUILD_ID);
 }catch(e){console.error("Stock tick:",e);}
}
let marketSyncRunning=false;
async function marketSyncCycle(){
 if(marketSyncRunning)return;
 marketSyncRunning=true;
 try{
  // One ordered cycle prevents chart redraws from racing ahead of the price tick.
  await stockTick();
  await syncLiveStockCharts();
  await syncLiveIndexCharts();
 }catch(e){console.error("Market sync cycle:",e);}
 finally{marketSyncRunning=false;}
}
setInterval(marketSyncCycle,60*1000).unref();
console.log("[MARKET ENGINE] Stock prices + all live charts: one synchronized 60-second cycle.");
setInterval(()=>{
 const m=process.memoryUsage();
 console.log(`[MEMORY] RSS ${(m.rss/1048576).toFixed(1)} MB • Heap ${(m.heapUsed/1048576).toFixed(1)} MB`);
},5*60*1000).unref();
setInterval(syncMarketDashboard,30000).unref();
setInterval(syncEconomicDashboard,30000).unref();
setInterval(marketBellLoop,60000).unref();
setInterval(autoMarketEventLoop,60000).unref();
setInterval(dailyFinancialReportLoop,60000).unref();
setInterval(savingsInterestLoop,15*60*1000).unref();
setInterval(loanPaymentLoop,5*60*1000).unref();
setInterval(autoEconomicEventLoop,10*60*1000).unref();
setInterval(automaticFiscalPolicyLoop,10*60*1000).unref();
setInterval(propertyBusinessTick,60*60*1000).unref();
setInterval(processLimitOrders,60*1000).unref();
setInterval(fullRoleAudit,5*60*1000).unref();



const PRISONER_ROLE_ID="1426147564998230087";
const JAILBOT_USER_ID="895542340993822741";
const AUTO_ROLES={
 RESIDENT:"1425924508866314432",CITIZEN:"1476015059426611282",
 SOVEREIGN:"1428116250659389510",HIGH_GOV:"1428116231935889580",
 MED_GOV:"1428116195772596365",LOW_GOV:"1428116168442380328",
 SECURITY:"1451809754769789110",INCOME_TAX:"1428116147273728181",
 BUSINESS:"1451809472405311489",MAJOR_BUSINESS:"1451809541195960354",
 SMALL_PROPERTY:"1428116129058001097",MED_PROPERTY:"1496920965186060379",
 LARGE_PROPERTY:"1453109199365210162",PROPERTY_TAX:"1496919591589380226",
 LARGE_PROPERTY_TAX:"1496919666134618222"
};
const ROLE_SYNC_MAP={
 sovereign:["1425924509889724417","1425924509889724416","1425924509822750891","1425924509822750883","1425924509743054968"],
 high:["1425924509365436500","1425924509365436499","1425924509348663310","1425924509315109020","1425924509315109023","1522231568112947394","1425924509315109022","1425924509315109017","1425924509315109021","1435722478772158608","1425924509315109019","1425924509315109018","1428753738323071059","1425942047730302976","1523372797932474559","1503163358168481943","1425924509340401733","1515143573446590646","1425924509248131201","1425924509315109015"],
 medium:["1425924509348663309","1548400861456375871","1503163624376762439","1523373617470115912","1550730368985075722","1503163383736832010","1466970002455265320","1425924509340401732","1425924509340401731","1425924509340401730","1434321853731700786","1434321830017110108","1425924509294133295","1425924509294133294","1553766311513825481"],
 low:["1427910155374166016","1466970060185927734","1425924509327953979","1425924509340401726","1426960610414825553","1426960656774725702","1503337770024833074","1425924509294133293","1553766221537607700","1553766260867600426","1425924509294133291","1425924509294133290","1425924509248131200"],
 security:["1547385155746795550","1503163358168481943","1503163383736832010","1466970002455265320","1466970060185927734","1429592764420587711","1427770196927709274","1427769874385604688","1427768931497803877","1427053056432013322","1427052862264836176","1427052830203838534","1427052648787345509","1425924509315109015","1434321853731700786","1434321830017110108","1434321781660979371","1434321664832704602","1434322603933171782"]
};
const FINANCE_ROLE_ID="1435722478772158608"; // 「▣」▏Commissar of Finance
const ECONOMIC_ROLE_IDS={
 "Large Property Owner":"1453109199365210162",
 "Medium Property":"1496920965186060379",
 "Small Property Owner":"1428116129058001097",
 "Sovereign Grant":"1428116250659389510",
 "Major Business Owner":"1451809541195960354",
 "Business Owner":"1451809472405311489",
 "High Government Pay":"1428116231935889580",
 "Medium Government Pay":"1428116195772596365",
 "Low Government Pay":"1428116168442380328",
 "Security Sector Salary":"1451809754769789110",
 "Blue Collar Worker":"1451809308554563645",
 "White Collar Worker":"1451809417459663003",
 "Large Property Tax":"1496919666134618222",
 "Property Tax":"1496919591589380226",
 "Income Tax":"1428116147273728181"
};
function canManageEconomy(member){
 return !!member && (
  member.permissions.has(PermissionFlagsBits.Administrator) ||
  member.roles.cache.has(FINANCE_ROLE_ID)
 );
}
async function buildGovernmentDashboard(g){
  const [tR,govR,setR,acctR,wealthR,txDayR,tx24R,payR,casinoR,lotR,ticketsR,betR,shopR,propR,stockR,holdR,govLedR]=await Promise.all([
   q(`SELECT * FROM economy_treasury WHERE guild_id=$1`,[g]),
   q(`SELECT * FROM economy_government WHERE guild_id=$1`,[g]),
   q(`SELECT * FROM economy_settings WHERE guild_id=$1`,[g]),
   q(`SELECT COALESCE(SUM(wallet),0) wallets,COALESCE(SUM(bank),0) banks,COUNT(*) accounts,COALESCE(AVG(wallet+bank),0) average FROM economy_accounts WHERE guild_id=$1`,[g]),
   q(`SELECT wallet+bank wealth FROM economy_accounts WHERE guild_id=$1 ORDER BY wealth`,[g]),
   q(`SELECT COUNT(*) count,COALESCE(SUM(amount),0) volume FROM economy_transactions WHERE guild_id=$1 AND created_at>=CURRENT_DATE`,[g]),
   q(`SELECT COUNT(*) count,COALESCE(SUM(amount),0) volume FROM economy_transactions WHERE guild_id=$1 AND created_at>=NOW()-INTERVAL '24 hours'`,[g]),
   q(`SELECT COUNT(*) claims,COALESCE(SUM(amount),0) total FROM economy_transactions WHERE guild_id=$1 AND type='payroll' AND created_at>=NOW()-INTERVAL '24 hours'`,[g]),
   q(`SELECT COUNT(*) plays,COALESCE(SUM(amount),0) wagers FROM economy_transactions WHERE guild_id=$1 AND type='casino' AND created_at>=NOW()-INTERVAL '24 hours'`,[g]),
   q(`SELECT * FROM economy_lottery WHERE guild_id=$1`,[g]),
   q(`SELECT COALESCE(SUM(tickets),0) tickets,COUNT(*) players FROM economy_lottery_tickets WHERE guild_id=$1`,[g]),
   q(`SELECT COUNT(*) open FROM economy_bets WHERE guild_id=$1 AND status='open'`,[g]),
   q(`SELECT COUNT(*) items,COALESCE(SUM(CASE WHEN active THEN 1 ELSE 0 END),0) active FROM economy_shop WHERE guild_id=$1`,[g]),
   q(`SELECT COUNT(*) total,COUNT(*) FILTER(WHERE s.item_type='house') houses,COUNT(*) FILTER(WHERE s.item_type='land') land,COUNT(*) FILTER(WHERE s.item_type='business') businesses FROM economy_properties p LEFT JOIN economy_shop s ON s.id=p.item_id WHERE p.guild_id=$1`,[g]),
   q(`SELECT COUNT(*) companies,COALESCE(SUM(supply),0) shares,COALESCE(SUM(price*supply),0) cap,COALESCE(AVG(price),0) avgprice FROM economy_stocks WHERE guild_id=$1 AND active=TRUE`,[g]),
   q(`SELECT COALESCE(SUM(h.shares),0) owned,COALESCE(SUM(h.shares*s.price),0) value,COUNT(DISTINCT h.user_id) investors FROM economy_stock_holdings h JOIN economy_stocks s ON s.id=h.stock_id WHERE h.guild_id=$1 AND h.shares>0`,[g]),
   q(`SELECT kind,category,COALESCE(SUM(amount),0) amount FROM economy_government_ledger WHERE guild_id=$1 GROUP BY kind,category ORDER BY amount DESC`,[g])
  ]);
  const t=tR.rows[0]||{},gov=govR.rows[0]||{},set=setR.rows[0]||{},ac=acctR.rows[0]||{},lot=lotR.rows[0]||{},tk=ticketsR.rows[0]||{},pr=propR.rows[0]||{},st=stockR.rows[0]||{},ho=holdR.rows[0]||{};
  const wealth=wealthR.rows.map(x=>+x.wealth),median=wealth.length?(wealth.length%2?wealth[(wealth.length-1)/2]:Math.round((wealth[wealth.length/2-1]+wealth[wealth.length/2])/2)):0;
  const govRevenue=govLedR.rows.filter(x=>x.kind==="revenue").reduce((s,x)=>s+ +x.amount,0),govSpend=govLedR.rows.filter(x=>x.kind==="expense").reduce((s,x)=>s+ +x.amount,0);
  const budget=+t.tax_revenue+govRevenue-govSpend,totalCitizen=+ac.wallets+ +ac.banks,tracked=totalCitizen+ +t.balance+ +gov.reserve_balance,debtRatio=tracked?((+gov.debt/tracked)*100):0;
  const budgetStatus=budget>0?"🟢 SURPLUS":budget<0?"🔴 DEFICIT":"🟡 BALANCED",debtStatus=debtRatio<10?"🟢 LOW":debtRatio<30?"🟡 MODERATE":"🔴 HIGH";
  const report=`RB-ECO-${new Date().getUTCFullYear()}-${String(Math.floor(Date.now()/86400000)%1000).padStart(3,"0")}`;
  const syncUnix=Math.floor(Date.now()/1000);
  const topCats=govLedR.rows.slice(0,8).map(x=>`${x.kind==="expense"?"▼":"▲"} ${x.category}: **${rm(x.amount)}**`).join("\n")||"No categorized government ledger activity.";
  const e1=new EmbedBuilder().setTitle("🏛️ THE AUTHORITY • REICHSMARK NATIONAL ECONOMIC REPORT").setDescription(`**REICHSBANK // NATIONAL ECONOMIC COMMAND CENTER**\n🟢 **LIVE • AUTO-SYNC ENABLED**\nReport **${report}** • Last synchronization <t:${syncUnix}:R>`).addFields(
   {name:"💰 NATIONAL BALANCE SHEET",value:`Treasury **${rm(t.balance||0)}**\nCentral reserves **${rm(gov.reserve_balance||0)}**\nPublic debt **${rm(gov.debt||0)}**\nNet government position **${rm((+t.balance||0)+(+gov.reserve_balance||0)-(+gov.debt||0))}**`},
   {name:"💶 MONETARY SYSTEM",value:`Citizen wallets **${rm(ac.wallets||0)}**\nCitizen bank deposits **${rm(ac.banks||0)}**\nCitizen financial assets **${rm(totalCitizen)}**\nTracked Reichsmark **${rm(tracked)}**\nActive economic accounts **${ac.accounts||0}**`},
   {name:"📊 CORE INDICATORS",value:`Budget position **${budgetStatus}**\nDebt position **${debtStatus}**\nDebt / tracked RM **${debtRatio.toFixed(2)}%**\nAverage citizen balance **${rm(Math.round(+ac.average||0))}**\nMedian citizen balance **${rm(median)}**`}
  ).setFooter({text:"REICHSBANK • National Economic Office • Reichsmark (RM)"}).setTimestamp();
  const e2=new EmbedBuilder().setTitle("📑 PUBLIC FINANCE & FISCAL OPERATIONS").addFields(
   {name:"Government Budget",value:`**${gov.budget_name||"General Budget"}**\nSpending authorization **${rm(gov.budget_spending_limit||0)}**\nTax revenue **${rm(t.tax_revenue||0)}**\nOther recorded revenue **${rm(govRevenue)}**\nRecorded expenditure **${rm(govSpend)}**\nFiscal balance **${budget>=0?"+":""}${rm(budget)}**`},
   {name:"Debt & Credit",value:`Outstanding debt **${rm(gov.debt||0)}**\nDebt ceiling **${rm(gov.debt_limit||0)}**\nRemaining capacity **${rm(Math.max(0,(+gov.debt_limit||0)-(+gov.debt||0)))}**\nInterest rate **${gov.interest_rate||0}%**`},
   {name:"Tax Code",value:`Income tax **${set.income_tax||0}%**\nProperty tax **${set.property_tax||0}%**\nLarge-property tax **${set.large_property_tax||0}%**`},
   {name:"Largest Ledger Categories",value:topCats}
  );
  const e3=new EmbedBuilder().setTitle("📈 NATIONAL MARKETS, PROPERTY & COMMERCE").addFields(
   {name:"Reichsmark Stock Exchange",value:`Listed companies **${st.companies||0}**\nShares authorized **${Number(st.shares||0).toLocaleString()}**\nInvestor-owned shares **${Number(ho.owned||0).toLocaleString()}**\nInvestors **${ho.investors||0}**\nMarket capitalization **${rm(Math.round(+st.cap||0))}**\nInvestor portfolio value **${rm(Math.round(+ho.value||0))}**\nAverage share price **${rm(Math.round(+st.avgprice||0))}**`},
   {name:"Property & Enterprise",value:`Registered properties **${pr.total||0}**\nHouses **${pr.houses||0}**\nLand holdings **${pr.land||0}**\nBusinesses **${pr.businesses||0}**\nShop listings **${shopR.rows[0]?.items||0}**\nActive shop listings **${shopR.rows[0]?.active||0}**`},
   {name:"Lottery & Community Markets",value:`Lottery jackpot **${rm(lot.jackpot||0)}**\nTicket price **${rm(lot.ticket_price||0)}**\nTickets in draw **${tk.tickets||0}**\nLottery participants **${tk.players||0}**\nOpen community bets **${betR.rows[0]?.open||0}**`}
  );
  const e4=new EmbedBuilder().setTitle("⚙️ ECONOMIC ACTIVITY & SYSTEM STATUS").addFields(
   {name:"Today",value:`Transactions **${txDayR.rows[0]?.count||0}**\nRecorded RM volume **${rm(txDayR.rows[0]?.volume||0)}**`,inline:true},
   {name:"Last 24 Hours",value:`Transactions **${tx24R.rows[0]?.count||0}**\nRecorded RM volume **${rm(tx24R.rows[0]?.volume||0)}**`,inline:true},
   {name:"Payroll — 24H",value:`Claims **${payR.rows[0]?.claims||0}**\nDistributed **${rm(payR.rows[0]?.total||0)}**`,inline:true},
   {name:"Casino — 24H",value:`Games recorded **${casinoR.rows[0]?.plays||0}**\nWager records **${rm(casinoR.rows[0]?.wagers||0)}**`,inline:true},
   {name:"System",value:`Currency **Reichsmark (RM)**\nDatabase **🟢 ONLINE**\nReporting **🟢 LIVE**\nAuto-sync **30 seconds**\nPayroll cycle **${set.payroll_hours||24} hours**`,inline:true},
   {name:"Report Integrity",value:"LIVE CONTROL FEED • Figures are recalculated directly from PostgreSQL every 30 seconds. Values with no recorded activity display as RM 0; no invented financial estimates are inserted."}
  ).setFooter({text:`${report} • Consolidated government economic statement`}).setTimestamp();
  
  return [e1,e2,e3,e4];
}
async function syncGovernmentDashboard(){
 try{
  const rows=(await q(`SELECT * FROM economy_live_dashboard`)).rows;
  for(const row of rows){
   try{
    const guild=await client.guilds.fetch(row.guild_id);
    const channel=await guild.channels.fetch(row.channel_id);
    if(!channel||!channel.isTextBased())continue;
    const message=await channel.messages.fetch(row.message_id);
    const embeds=await buildGovernmentDashboard(row.guild_id);
    await message.edit({embeds});
    await q(`UPDATE economy_live_dashboard SET last_sync=NOW() WHERE guild_id=$1`,[row.guild_id]);
   }catch(e){console.error("Dashboard sync:",e.message);}
  }
 }catch(e){console.error("Dashboard loop:",e);}
}
setInterval(syncGovernmentDashboard,30000);


// ── QUICK PREFIX COMMANDS ─────────────────────────────────────────────
// Requires Discord Developer Portal -> Bot -> MESSAGE CONTENT INTENT = ON.
// Slash commands remain available. These are faster aliases for common economy actions.
client.on("messageCreateLegacyDisabled",async message=>{
 try{
  if(!message.guild||message.guild.id!==GUILD_ID||message.author.bot||!message.content.startsWith("!"))return;
  const raw=message.content.slice(1).trim();
  if(!raw)return;
  const parts=raw.split(/\s+/),cmd=parts.shift().toLowerCase();
  const g=message.guild.id,u=message.author.id;
  const member=message.member||await message.guild.members.fetch(u);
  const send=(title,description,fields=[])=>message.reply({embeds:[new EmbedBuilder()
   .setAuthor({name:message.author.username,iconURL:message.author.displayAvatarURL({size:128})})
   .setTitle(title).setDescription(description).addFields(fields)
   .setFooter({text:"TA Reichsmark Economy • Quick Command"}).setTimestamp()]});

  if(["bal","balance","account"].includes(cmd)){
   const a=await acct(g,u);
   return send("🏦 Reichsbank Account",`Your current Reichsmark account.`,[
    {name:"💵 Wallet",value:`**${rm(+a.wallet)}**`,inline:true},
    {name:"🏦 Bank",value:`**${rm(+a.bank)}**`,inline:true},
    {name:"💰 Liquid Total",value:`**${rm(+a.wallet + +a.bank)}**`,inline:true}
   ]);
  }

  if(cmd==="work"){
   const a=await acct(g,u),last=a.last_work?+new Date(a.last_work):0,remain=20000-(Date.now()-last);
   if(remain>0)return send("⏱️ Work Cooldown",`Your next shift is available in **${Math.ceil(remain/1000)} second(s)**.`);
   const prisoner=await memberIsPrisoner(member);
   if(prisoner)await enforcePrisonerRoles(member,"prefix_prison_work_guard");
   const n=prisoner?crypto.randomInt(PRISON_WORK_MIN,PRISON_WORK_MAX+1):crypto.randomInt(WORK_MIN,WORK_MAX+1);
   await give(g,u,n);
   await q(`UPDATE economy_accounts SET last_work=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u]);
   await tx(g,null,u,n,prisoner?"prison_work":"work",prisoner?"Prison work income":"Work income");
   const fresh=await acct(g,u),job=pick(prisoner?PRISON_WORK:CIVIL_WORK);
   return send(prisoner?"🔒 Prison Employment":"💼 Employment Completed",
    `You worked as a **${job}** and earned **${rm(n)}!**`,[
     {name:"Balance",value:`**${rm(+fresh.wallet)}**`,inline:true},
     {name:"Next Shift",value:"**20 seconds**",inline:true}
    ]);
  }

  if(cmd==="daily"){
   if(await memberIsPrisoner(member)){await enforcePrisonerRoles(member,"prefix_daily_guard");return send("🔒 Action Denied","Inmates cannot claim the daily RM reward.");}
   const a=await acct(g,u),last=a.last_daily?+new Date(a.last_daily):0;
   if(Date.now()-last<86400000)return send("🎁 Daily Reward","Your daily reward has already been claimed.");
   await q(`UPDATE economy_accounts SET wallet=wallet+$3,last_daily=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u,DAILY]);
   await tx(g,null,u,DAILY,"daily","Daily reward");
   const fresh=await acct(g,u);
   return send("🎁 Daily Reward",`You received **${rm(DAILY)}**.`,[{name:"Wallet",value:`**${rm(+fresh.wallet)}**`,inline:true}]);
  }

  if(["dep","deposit"].includes(cmd)){
   const a=await acct(g,u);
   const arg=(parts[0]||"").toLowerCase();
   const n=arg==="all"?+a.wallet:Number(arg.replace(/,/g,""));
   if(!Number.isSafeInteger(n)||n<=0)return send("🏦 Bank Deposit","Use **!dep <amount>** or **!dep all**.");
   if(+a.wallet<n)return send("🏦 Bank Deposit","You don't have enough RM in your wallet.");
   await q(`UPDATE economy_accounts SET wallet=wallet-$3,bank=bank+$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,n]);
   await tx(g,u,u,n,"bank_deposit","Wallet → Bank");
   const fresh=await acct(g,u);
   return send("🏦 Deposit Complete",`Deposited **${rm(n)}** into your bank.`,[
    {name:"Wallet",value:`**${rm(+fresh.wallet)}**`,inline:true},
    {name:"Bank",value:`**${rm(+fresh.bank)}**`,inline:true}
   ]);
  }

  if(["with","withdraw"].includes(cmd)){
   const a=await acct(g,u);
   const arg=(parts[0]||"").toLowerCase();
   const n=arg==="all"?+a.bank:Number(arg.replace(/,/g,""));
   if(!Number.isSafeInteger(n)||n<=0)return send("🏦 Bank Withdrawal","Use **!with <amount>** or **!with all**.");
   if(+a.bank<n)return send("🏦 Bank Withdrawal","You don't have enough RM in your bank.");
   await q(`UPDATE economy_accounts SET wallet=wallet+$3,bank=bank-$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,n]);
   await tx(g,u,u,n,"bank_withdrawal","Bank → Wallet");
   const fresh=await acct(g,u);
   return send("🏦 Withdrawal Complete",`Withdrew **${rm(n)}** from your bank.`,[
    {name:"Wallet",value:`**${rm(+fresh.wallet)}**`,inline:true},
    {name:"Bank",value:`**${rm(+fresh.bank)}**`,inline:true}
   ]);
  }

  if(cmd==="rob"){
   const target=message.mentions.users.first();
   if(!target)return send("🚨 Robbery","Use **!rob @member**.");
   if(target.bot||target.id===u)return send("🚨 Robbery","Choose another non-bot member.");
   if(await memberIsPrisoner(member)){await enforcePrisonerRoles(member,"prefix_prison_rob_guard");return send("🔒 Action Denied","Incarcerated members cannot rob other accounts.");}
   const targetMember=await message.guild.members.fetch(target.id).catch(()=>null);
   if(!targetMember)return send("🚨 Robbery","That member is not currently in the server.");
   if(await memberIsPrisoner(targetMember))return send("🚨 Robbery","Incarcerated accounts cannot be targeted.");
   const robber=await acct(g,u),victim=await acct(g,target.id),last=robber.last_rob?+new Date(robber.last_rob):0;
   const remain=ROB_COOLDOWN-(Date.now()-last);
   if(remain>0)return send("🚨 Lay Low",`Wait **${Math.ceil(remain/60000)} minute(s)** before another robbery.`);
   if(+victim.wallet<50)return send("🚨 Robbery","That member does not have enough wallet RM to rob.");
   await q(`UPDATE economy_accounts SET last_rob=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u]);
   const incident=shortTx(),roll=crypto.randomInt(1,101),jackpot=roll<=5,success=jackpot||roll<=48;
   if(success){
    const cap=jackpot?1500:600,pct=jackpot?.20:.12;
    const amount=Math.max(1,Math.min(cap,Math.floor(+victim.wallet*pct),jackpot?crypto.randomInt(600,1501):crypto.randomInt(50,601)));
    const moved=await q(`UPDATE economy_accounts SET wallet=wallet-$3 WHERE guild_id=$1 AND user_id=$2 AND wallet>=$3 RETURNING wallet`,[g,target.id,amount]);
    if(!moved.rowCount)return send("🚨 Robbery","The target's wallet changed before the robbery finished. No RM was taken.");
    await give(g,u,amount);await tx(g,target.id,u,amount,jackpot?"robbery_jackpot":"robbery","Fictional RM robbery");
    const witnessed=crypto.randomInt(1,101)<=25,story=pick(jackpot?ROB_JACKPOT:ROB_SUCCESS),fresh=await acct(g,u);
    const embed=new EmbedBuilder().setAuthor({name:message.author.username,iconURL:message.author.displayAvatarURL({size:128})})
     .setTitle(jackpot?"💎 The Heist of the Century!":"💰 Robbery Successful")
     .setDescription(`**${story}**\n\nYou stole **${rm(amount)}** from **${target.username}**!`)
     .addFields({name:"Your Balance",value:`**${rm(+fresh.wallet)}**`,inline:true},{name:"Police Alert",value:witnessed?"🚨 **WITNESSED**":"🕶️ **GOT AWAY UNSEEN**",inline:true},{name:"Next Robbery",value:"**10 minutes**",inline:true})
     .setThumbnail(target.displayAvatarURL({size:128})).setFooter({text:`TA Reichsmark Economy • Incident #${incident}`}).setTimestamp();
    if(witnessed)return message.reply({content:`<@&${POLICE_ROLE_ID}> 🚨 Theft alert • Suspect: <@${u}> • Victim: <@${target.id}> • Incident #${incident}`,embeds:[embed],allowedMentions:{roles:[POLICE_ROLE_ID],users:[u,target.id]}});
    return message.reply({embeds:[embed]});
   }
   const fine=Math.min(+robber.wallet,crypto.randomInt(75,251));
   if(fine>0){
    await q(`UPDATE economy_accounts SET wallet=wallet-$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,fine]);
    await q(`INSERT INTO economy_treasury(guild_id,balance,tax_revenue,expenses) VALUES($1,$2,0,0) ON CONFLICT(guild_id) DO UPDATE SET balance=economy_treasury.balance+$2`,[g,fine]);
    await tx(g,u,null,fine,"robbery_fine","Failed fictional RM robbery fine");
   }
   const fresh=await acct(g,u),story=pick(ROB_FAIL);
   const embed=new EmbedBuilder().setAuthor({name:message.author.username,iconURL:message.author.displayAvatarURL({size:128})})
    .setTitle("🚔 Robbery Failed").setDescription(`**${story}**\n\nYou failed to rob **${target.username}**.`)
    .addFields({name:"Fine",value:`**${rm(fine)}**`,inline:true},{name:"Your Balance",value:`**${rm(+fresh.wallet)}**`,inline:true},{name:"Next Robbery",value:"**10 minutes**",inline:true})
    .setThumbnail(target.displayAvatarURL({size:128})).setFooter({text:`TA Reichsmark Economy • Incident #${incident}`}).setTimestamp();
   return message.reply({content:`<@&${POLICE_ROLE_ID}> 🚨 Theft suspect: <@${u}> • Victim: <@${target.id}> • Incident #${incident}`,embeds:[embed],allowedMentions:{roles:[POLICE_ROLE_ID],users:[u,target.id]}});
  }

  if(cmd==="paycheck"){
   if(await memberIsPrisoner(member)){await enforcePrisonerRoles(member,"prefix_paycheck_guard");return send("🔒 Action Denied","Inmates cannot collect salary paychecks.");}
   const a=await acct(g,u),last=a.last_paycheck?+new Date(a.last_paycheck):0;
   if(Date.now()-last<86400000)return send("💵 Paycheck",`Your next paycheck is available <t:${Math.floor((last+86400000)/1000)}:R>.`);
   const p=await payroll(member);if(!p.length)return send("💵 Paycheck","You do not have a configured payroll role.");
   const set=(await q(`SELECT * FROM economy_settings WHERE guild_id=$1`,[g])).rows[0],gross=p.reduce((s,x)=>s+ +x.amount,0);
   let rate=member.roles.cache.has(ECONOMIC_ROLE_IDS["Income Tax"])?+set.income_tax:0;
   if(member.roles.cache.has(ECONOMIC_ROLE_IDS["Large Property Tax"]))rate+=+set.large_property_tax;
   else if(member.roles.cache.has(ECONOMIC_ROLE_IDS["Property Tax"]))rate+=+set.property_tax;
   const tax=Math.min(gross,Math.round(gross*rate/100)),net=gross-tax;
   await give(g,u,net);await q(`UPDATE economy_accounts SET last_paycheck=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u]);
   await q(`UPDATE economy_treasury SET balance=balance+$2,tax_revenue=tax_revenue+$2 WHERE guild_id=$1`,[g,tax]);
   await tx(g,null,u,net,"payroll",`Gross ${gross}; tax ${tax}`);
   return send("💵 Paycheck Deposited",`Your payroll has been processed.`,[
    {name:"Gross",value:`**${rm(gross)}**`,inline:true},{name:"Tax",value:`**${rm(tax)}**`,inline:true},{name:"Net",value:`**${rm(net)}**`,inline:true}
   ]);
  }

  if(cmd==="help"){
   return send("💠 Reichsmark Quick Commands",
`**!work** — work for RM
**!rob @member** — attempt a robbery
**!bal** — account balance
**!daily** — daily reward
**!dep <amount>** — deposit RM
**!dep all** — deposit your entire wallet
**!with <amount>** — withdraw RM
**!with all** — withdraw your entire bank balance
**!paycheck** — collect payroll

Slash commands remain available for the full economy, market, business, property, stock, casino, lottery, government and finance systems.`);
  }
 }catch(e){
  console.error("[PREFIX COMMAND]",e);
  return message.reply({embeds:[new EmbedBuilder().setTitle("⚠️ Reichsmark Command Error").setDescription("That command could not be completed. Please try again.").setTimestamp()]}).catch(()=>{});
 }
});


// ── TA ANNOUNCEMENTS → FICTIONAL MARKET REACTION ─────────────────────
// Reads new posts from the linked official TA announcements channel.
// It never creates government announcements; it only reacts after a message is actually posted.
function classifyTAAnnouncement(text){
 const t=String(text||"").toLowerCase();
 const rules=[
  {type:"WAR",words:["declare war","declaration of war","state of war","war has been declared","military conflict","mobilization","military operation"],base:-3.8,duration:6},
  {type:"PEACE",words:["peace treaty","ceasefire","armistice","peace agreement","end of hostilities"],base:2.8,duration:5},
  {type:"SANCTIONS",words:["sanction","embargo","trade restriction"],base:-2.4,duration:5},
  {type:"TRADE_DEAL",words:["trade agreement","trade deal","free trade","new trade partner","trade partnership"],base:2.2,duration:5},
  {type:"EMERGENCY",words:["state of emergency","national emergency","emergency declared","major disaster","crisis"],base:-3.0,duration:4},
  {type:"INFRASTRUCTURE",words:["infrastructure","rail expansion","new railway","public works","transport investment","construction project"],base:2.0,duration:6},
  {type:"GOV_SPENDING",words:["spending package","government investment","funding package","stimulus","appropriation","budget increase","grant"],base:1.5,duration:5},
  {type:"TAX_INCREASE",words:["tax increase","raise taxes","taxes increased","higher tax","tax hike"],base:-1.8,duration:5},
  {type:"TAX_CUT",words:["tax cut","lower taxes","taxes reduced","reduce taxes"],base:1.8,duration:5},
  {type:"ENERGY_CRISIS",words:["energy crisis","fuel shortage","power shortage","energy shortage"],base:-3.2,duration:5},
  {type:"BUSINESS",words:["business","company","corporation","industry","factory","employment","jobs"],base:.45,duration:3},
  {type:"LEGISLATION",words:["act passed","bill passed","law passed","legislation","congress passed","signed into law"],base:.25,duration:3},
  {type:"LEADERSHIP",words:["appointed","appointment","resigned","resignation","elected","inaugurated","chancellor","minister"],base:0,duration:2},
  {type:"EXPANSION",words:["territorial expansion","new territory","annexation"],base:.8,duration:4},
  {type:"MAJOR_POLICY",words:["major reform","economic reform","new economic policy","policy change"],base:.7,duration:4}
 ];
 return rules.find(r=>r.words.some(w=>t.includes(w)))||{type:"GENERAL_NEWS",words:[],base:0,duration:2};
}
function announcementText(message){
 const embedText=[...message.embeds].map(e=>[e.title,e.description,...(e.fields||[]).flatMap(f=>[f.name,f.value])].filter(Boolean).join(" ")).join(" ");
 return `${message.content||""} ${embedText}`.trim();
}
async function applyTAAnnouncementToMarket(message,rule){
 const g=message.guild.id;
 const already=(await q(`SELECT 1 FROM economy_announcement_events WHERE guild_id=$1 AND message_id=$2`,[g,message.id])).rowCount;
 if(already)return;
 const text=announcementText(message);
 const stocks=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND active=TRUE`,[g])).rows;
 const until=new Date(Date.now()+rule.duration*3600000);
 const impacts=[];
 if(rule.base!==0 && stocks.length){
  for(const s of stocks){
   let mult=.65+Math.random()*.7;
   const name=`${s.name} ${s.symbol}`.toLowerCase();
   if(rule.type==="WAR" && /(arms|defen|security|industrial|technology)/.test(name))mult*=-.45;
   if(rule.type==="INFRASTRUCTURE" && /(transport|rail|construction|industrial)/.test(name))mult*=1.65;
   if(rule.type==="ENERGY_CRISIS" && /(energy|power|fuel)/.test(name))mult*=-.35;
   const impact=Math.max(-7,Math.min(7,rule.base*mult));
   await q(`INSERT INTO economy_market_events(guild_id,stock_id,title,description,impact_pct,expires_at,active,created_by)
     VALUES($1,$2,$3,$4,$5,$6,TRUE,$7)`,[g,s.id,`TA Announcement • ${rule.type}`,`Automatic reaction to official TA announcement in <#${message.channelId}>.`,impact,until,message.author.id]);
   impacts.push({symbol:s.symbol,impact});
  }
 }
 await q(`INSERT INTO economy_announcement_events(guild_id,message_id,event_type,summary) VALUES($1,$2,$3,$4)`,[g,message.id,rule.type,text.slice(0,500)]);
 const settings=(await q(`SELECT news_channel_id FROM economy_market_settings WHERE guild_id=$1`,[g])).rows[0];
 if(settings?.news_channel_id){
  const ch=await client.channels.fetch(settings.news_channel_id).catch(()=>null);
  if(ch?.isTextBased()){
   const avg=impacts.length?impacts.reduce((a,b)=>a+b.impact,0)/impacts.length:0;
   const top=[...impacts].sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,6).map(x=>`**${x.symbol}** ${x.impact>=0?"▲":"▼"} ${x.impact>=0?"+":""}${x.impact.toFixed(2)}%`).join("\n");
   const neutral=rule.base===0;
   await ch.send({embeds:[new EmbedBuilder().setTitle(`🏛️ TA ANNOUNCEMENT → MARKET NEWS • ${rule.type.replaceAll("_"," ")}`)
    .setDescription(neutral?`An official TA announcement was detected in <#${message.channelId}>.\n\n**Market impact:** ◆ Neutral / no significant simulated price impact.`:`An official TA announcement was detected in <#${message.channelId}> and temporary market pressure was applied.\n\n**Detected event:** ${rule.type.replaceAll("_"," ")}\n**Broad market pressure:** ${avg>0?"▲ Positive":avg<0?"▼ Negative":"◆ Mixed"} **${avg>=0?"+":""}${avg.toFixed(2)}%**\n**Expected duration:** approximately **${rule.duration}h**`)
    .addFields({name:"Announcement summary",value:(text||"Announcement contained an embed/attachment.").slice(0,900),inline:false},{name:"Largest simulated reactions",value:neutral?"No stock-price pressure applied.":(top||"No listed securities."),inline:false},{name:"Source announcement",value:`[Open original TA announcement](${message.url})`,inline:false})
    .setFooter({text:"Automatic TA announcement monitor • fictional RM market"}).setTimestamp()]});
  }
 }
 if(rule.base!==0)await marketSyncCycle();
 else {await syncLiveStockCharts();await syncLiveIndexCharts();}
}

client.on("messageCreate",async message=>{
 try{
  if(!message.guild||message.author.bot)return;
  const link=(await q(`SELECT * FROM economy_announcement_links WHERE guild_id=$1 AND enabled=TRUE`,[message.guild.id])).rows[0];
  if(!link||message.channelId!==link.announcement_channel_id)return;
  const rule=classifyTAAnnouncement(announcementText(message));
  await applyTAAnnouncementToMarket(message,rule);
 }catch(e){console.error("[TA ANNOUNCEMENT MARKET LINK]",e);}
});

client.once("clientReady",async()=>{await init();const guild=await client.guilds.fetch(GUILD_ID);await seedRoles(guild);await seedMarketAndShop(GUILD_ID);
 const marketCfg=(await q(`SELECT news_channel_id FROM economy_market_settings WHERE guild_id=$1`,[GUILD_ID])).rows[0];
 if(marketCfg?.news_channel_id){
  const marketNewsChannel=await guild.channels.fetch(marketCfg.news_channel_id).catch(()=>null);
  console.log(`[MARKET NEWS] Configured channel: ${marketCfg.news_channel_id} • ${marketNewsChannel?.isTextBased()?"READY":"NOT ACCESSIBLE"}`);
 }else console.warn("[MARKET NEWS] No market news channel configured. Run /marketsetup.");
 // Preserve the PostgreSQL next_auto_event_at value across Render restarts.
 // autoMarketEventLoop() creates a new 5–20 minute schedule only when no
 // schedule exists or after the scheduled bulletin has actually been processed.
 const persistedMarketNews=(await q(
  `SELECT next_auto_event_at FROM economy_market_settings WHERE guild_id=$1`,
  [GUILD_ID]
 )).rows[0];
 if(persistedMarketNews?.next_auto_event_at){
  console.log(`[MARKET NEWS] Resuming saved bulletin schedule • ${new Date(persistedMarketNews.next_auto_event_at).toISOString()}.`);
 }else{
  await scheduleNextAutoEvent(GUILD_ID,5,20);
  console.log("[MARKET NEWS] No saved bulletin schedule found; created the first 5–20 minute schedule.");
 }
 await marketBellLoop();await autoMarketEventLoop();await saveNationalStats(GUILD_ID);await ensureEconomicDashboard();await savingsInterestLoop();await loanPaymentLoop();await processLimitOrders();setTimeout(()=>fullRoleAudit(),10000);await new REST({version:"10"}).setToken(TOKEN).put(Routes.applicationGuildCommands(client.user.id,GUILD_ID),{body:commands});console.log(`Online: ${client.user.tag}`);setTimeout(()=>runStartupUnbImport(guild),3000);});
client.on("guildMemberAdd",async member=>{
 try{
  if(member.guild.id!==GUILD_ID||member.user.bot)return;

  // A previously-active inmate goes straight back to prisoner isolation on rejoin.
  if(await isPersistentPrisoner(member.guild.id,member.id)){
   await acct(member.guild.id,member.id);
   await enforcePrisonerRoles(member,"rejoined_while_incarcerated");
   console.log(`[PRISON] Returning inmate rejoined and was restored: ${member.user.tag} (${member.id})`);
   return;
  }

  await grant(member.guild.id,member.id);
  await q(`INSERT INTO economy_citizenship(guild_id,user_id,citizen,source) VALUES($1,$2,FALSE,'join') ON CONFLICT DO NOTHING`,[member.guild.id,member.id]);
  await syncFreshMember(member.guild,member.id);
  console.log(`[ROLE SYNC] New member initialized: ${member.user.tag} (${member.id})`);
 }catch(e){console.error("[ROLE SYNC] New member setup failed:",e);}
});

client.on("guildMemberRemove",async member=>{
 try{
  if(member.guild.id!==GUILD_ID||member.user.bot)return;
  // If they leave while carrying the prisoner role, preserve incarceration in PostgreSQL.
  if(member.roles.cache.has(PRISONER_ROLE_ID)){
   await setPrisonStatus(member.guild.id,member.id,true,"left_server_while_incarcerated");
   console.log(`[PRISON] Inmate left server; rejoin protection retained for ${member.id}`);
  }
 }catch(e){console.error("[PRISON] Leave persistence failed:",e);}
});

client.on("guildMemberUpdate",async(oldMember,newMember)=>{
 try{
  if(newMember.guild.id!==GUILD_ID||newMember.user.bot)return;
  const oldIds=new Set(oldMember.roles.cache.keys()),newIds=new Set(newMember.roles.cache.keys());
  const changed=oldIds.size!==newIds.size||[...newIds].some(x=>!oldIds.has(x))||[...oldIds].some(x=>!newIds.has(x));
  if(!changed)return;

  const hadPrisoner=oldIds.has(PRISONER_ROLE_ID);
  const hasPrisoner=newIds.has(PRISONER_ROLE_ID);

  // Adding Prisoner starts persistent incarceration immediately.
  if(!hadPrisoner&&hasPrisoner){
   await setPrisonStatus(newMember.guild.id,newMember.id,true,"prisoner_role_added");
   await enforcePrisonerRoles(newMember,"prisoner_role_added");
   console.log(`[PRISON] Inmate status activated: ${newMember.user.tag} (${newMember.id})`);
   return;
  }

  // Only the actual release bot can clear persistent incarceration.
  if(hadPrisoner&&!hasPrisoner){
   const persistent=await isPersistentPrisoner(newMember.guild.id,newMember.id);
   let jailbotRelease=false;
   // Audit-log entries may arrive after the member update. Retry before re-jailing.
   for(let attempt=0;attempt<5&&!jailbotRelease;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1200));
    const audit=await newMember.guild.fetchAuditLogs({type:25,limit:25}).catch(e=>{
     console.error(`[PRISON] Audit log unavailable (View Audit Log permission required): ${e.message}`);
     return null;
    });
    jailbotRelease=[...(audit?.entries?.values?.()||[])].some(entry=>{
     const targetId=entry.target?.id||entry.targetId;
     const changes=entry.changes||[];
     const removed=changes.some(change=>change.key==="$remove"&&
      Array.isArray(change.new)&&change.new.some(role=>String(role.id)===PRISONER_ROLE_ID));
     return targetId===newMember.id&&entry.executor?.id===JAILBOT_USER_ID&&
      Date.now()-entry.createdTimestamp<60000&&removed;
    });
   }
   if(jailbotRelease){
    await releasePrisoner(newMember,"released_by_jailbot");
    await economyLog(newMember.guild.id,"🔓 JailBot Release",`<@${newMember.id}>`,[
     {name:"Released by",value:`<@${JAILBOT_USER_ID}>`,inline:true},
     {name:"Status",value:"Released; original roles and economic payroll synchronized",inline:false}
    ]);
    console.log(`[PRISON] JailBot release accepted for ${newMember.id}`);
    return;
   }
   if(persistent){
    // Re-fetch to avoid re-jailing after another handler already accepted release.
    if(await isPersistentPrisoner(newMember.guild.id,newMember.id)){
     const fresh=await newMember.guild.members.fetch(newMember.id).catch(()=>newMember);
     if(!fresh.roles.cache.has(PRISONER_ROLE_ID))await enforcePrisonerRoles(fresh,"blocked_unauthorized_release");
    }
    return;
   }
  }

  if(hasPrisoner||await isPersistentPrisoner(newMember.guild.id,newMember.id)){
   await enforcePrisonerRoles(newMember,"prisoner_role_guard");
   return;
  }

  console.log(`[ROLE SYNC] Discord role change detected for ${newMember.user.tag} (${newMember.id})`);
  await syncFreshMember(newMember.guild,newMember.id);
 }catch(e){console.error("[ROLE SYNC] Member role update failed:",e);}
});

client.on("error",e=>console.error("[DISCORD CLIENT ERROR]",e));
process.on("unhandledRejection",e=>console.error("[UNHANDLED REJECTION]",e));

client.on("interactionCreate",async i=>{
 if(i.guildId!==GUILD_ID)return;
 try{
 if(i.isButton()){
  // ACKNOWLEDGE BUTTONS IMMEDIATELY.
  // Discord invalidates an interaction if database/permission work takes too long.
  // After deferUpdate(), old button code can keep using i.reply() and i.update():
  // replies become follow-ups, and updates become edits of the original message.
  try{
   await i.deferUpdate();
  }catch(e){
   if(e?.code===10062){
    console.warn(`[INTERACTION] Expired button ignored safely: ${i.id} ${i.customId}`);
    return;
   }
   throw e;
  }
  const __buttonFollowUp=i.followUp.bind(i);
  i.reply=payload=>{
   if(payload&&typeof payload==="object"&&!Array.isArray(payload)){
    const clean={...payload};
    if(clean.ephemeral===true){delete clean.ephemeral;clean.flags=64;}
    return __buttonFollowUp(clean);
   }
   return __buttonFollowUp({content:String(payload??""),flags:64});
  };
  i.update=payload=>i.message.edit(payload);

  if(i.customId.startsWith("stocktrade_accept_")||i.customId.startsWith("stocktrade_decline_")){
   const id=Number(i.customId.split("_").pop());
   const offer=(await q(`SELECT o.*,s.symbol,s.name FROM economy_stock_trade_offers o JOIN economy_stocks s ON s.id=o.stock_id WHERE o.id=$1 AND o.guild_id=$2`,[id,i.guildId])).rows[0];
   if(!offer)return i.reply({content:"That trade offer no longer exists.",ephemeral:true});
   if(i.user.id!==offer.buyer_id)return i.reply({content:"Only the member receiving this trade offer can respond.",ephemeral:true});
   if(offer.status!=="open")return i.reply({content:`This trade is already **${offer.status}**.`,ephemeral:true});
   if(new Date(offer.expires_at)<=new Date()){
    await q(`UPDATE economy_stock_trade_offers SET status='expired' WHERE id=$1 AND status='open'`,[id]);
    return i.update({embeds:[new EmbedBuilder().setTitle("⌛ Stock Trade Expired").setDescription(`Trade #${id} expired before it was accepted.`).setTimestamp()],components:[]});
   }
   if(i.customId.startsWith("stocktrade_decline_")){
    await q(`UPDATE economy_stock_trade_offers SET status='declined',completed_at=NOW() WHERE id=$1 AND status='open'`,[id]);
    return i.update({embeds:[new EmbedBuilder().setTitle("❌ Stock Trade Declined").setDescription(`<@${offer.buyer_id}> declined **${offer.shares} ${offer.symbol}** from <@${offer.seller_id}>.`).setFooter({text:`Trade #${id}`}).setTimestamp()],components:[]});
   }
   const sellerHolding=(await q(`SELECT shares,avg_cost FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[i.guildId,offer.seller_id,offer.stock_id])).rows[0];
   if(!sellerHolding||Number(sellerHolding.shares)<Number(offer.shares)){
    await q(`UPDATE economy_stock_trade_offers SET status='failed',completed_at=NOW() WHERE id=$1`,[id]);
    return i.update({embeds:[new EmbedBuilder().setTitle("⚠️ Stock Trade Failed").setDescription("The seller no longer owns enough shares to complete this trade.").setTimestamp()],components:[]});
   }
   const total=Math.round(Number(offer.shares)*Number(offer.price_per_share));
   const buyer=await acct(i.guildId,offer.buyer_id);
   if(Number(buyer.wallet)<total)return i.reply({content:`You need **${rm(total)}** in your wallet to accept this trade.`,ephemeral:true});
   // Claim the offer first so two button deliveries cannot execute it twice.
   const claim=await q(`UPDATE economy_stock_trade_offers SET status='processing' WHERE id=$1 AND status='open' RETURNING id`,[id]);
   if(!claim.rowCount)return i.reply({content:"That trade is already being processed.",ephemeral:true});
   try{
    const debit=await q(`UPDATE economy_accounts SET wallet=wallet-$3 WHERE guild_id=$1 AND user_id=$2 AND wallet>=$3 RETURNING wallet`,[i.guildId,offer.buyer_id,total]);
    if(!debit.rowCount)throw new Error("BUYER_FUNDS_CHANGED");
    const takeShares=await q(`UPDATE economy_stock_holdings SET shares=shares-$4 WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3 AND shares>=$4 RETURNING shares`,[i.guildId,offer.seller_id,offer.stock_id,offer.shares]);
    if(!takeShares.rowCount){await give(i.guildId,offer.buyer_id,total);throw new Error("SELLER_SHARES_CHANGED");}
    await give(i.guildId,offer.seller_id,total);
    const bh=(await q(`SELECT shares,avg_cost FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[i.guildId,offer.buyer_id,offer.stock_id])).rows[0];
    const os=Number(bh?.shares||0),oa=Number(bh?.avg_cost||0),ns=os+Number(offer.shares),na=((os*oa)+total)/ns;
    await q(`INSERT INTO economy_stock_holdings(guild_id,user_id,stock_id,shares,avg_cost) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(guild_id,user_id,stock_id) DO UPDATE SET shares=$4,avg_cost=$5`,[i.guildId,offer.buyer_id,offer.stock_id,ns,na]);
    await q(`UPDATE economy_stock_trade_offers SET status='completed',completed_at=NOW() WHERE id=$1`,[id]);
    await tx(i.guildId,offer.buyer_id,offer.seller_id,total,"stock_p2p_trade",`${offer.shares} ${offer.symbol} @ ${offer.price_per_share}`);
    return i.update({embeds:[new EmbedBuilder().setTitle("🤝 Stock Trade Completed")
      .setDescription(`<@${offer.seller_id}> sold **${offer.shares} ${offer.symbol}** directly to <@${offer.buyer_id}>.`)
      .addFields({name:"Price / Share",value:`**${rm(offer.price_per_share)}**`,inline:true},{name:"Total",value:`**${rm(total)}**`,inline:true})
      .setFooter({text:`TA Reichsmark Exchange • Trade #${id} • fictional RM only`}).setTimestamp()],components:[]});
   }catch(e){
    await q(`UPDATE economy_stock_trade_offers SET status='failed',completed_at=NOW() WHERE id=$1`,[id]);
    return i.update({embeds:[new EmbedBuilder().setTitle("⚠️ Stock Trade Failed").setDescription("Balances or share ownership changed before the trade completed. No duplicate trade was executed.").setTimestamp()],components:[]});
   }
  }
  if(i.customId!=="gov_refresh")return;
  if(!canManageEconomy(i.member))return i.reply({content:"⛔ This live government control center is restricted to server Administrators and the Commissar of Finance.",ephemeral:true});
  const embeds=await buildGovernmentDashboard(i.guildId);
  await i.message.edit({embeds,components:i.message.components});
  await q(`UPDATE economy_live_dashboard SET last_sync=NOW() WHERE guild_id=$1`,[i.guildId]);
  return;
 }
 if(!i.isChatInputCommand())return;
 const __reply=i.reply.bind(i),__editReply=i.editReply.bind(i),__followUp=i.followUp.bind(i);
 i.reply=payload=>__reply(forceCommandEmbed(i.commandName,payload,i.user));
 i.editReply=payload=>__editReply(forceCommandEmbed(i.commandName,payload,i.user));
 i.followUp=payload=>__followUp(forceCommandEmbed(i.commandName,payload,i.user));


 // Cross-instance duplicate guard: only one process may execute this Discord interaction.
 const claim=await q(`INSERT INTO economy_interaction_claims(interaction_id) VALUES($1)
  ON CONFLICT(interaction_id) DO NOTHING RETURNING interaction_id`,[i.id]);
 if(!claim.rowCount){
  console.warn(`[INTERACTION] Duplicate ignored: ${i.id} /${i.commandName}`);
  return;
 }

 // Acknowledge Discord before database/API work so the interaction cannot expire.
 const privateCommands=new Set(["transactions","salary","inventory","properties","portfolio","credit","loan","savings","economy","economylog","marketsetup"]);
 const shouldBePrivate=privateCommands.has(i.commandName);
 await i.deferReply(shouldBePrivate?{flags:64}:{});

 // Existing command code uses i.reply(). After deferring, safely convert those
 // initial replies to editReply() instead of trying to acknowledge a second time.
 const _editReply=i.editReply.bind(i);
 const _followUp=i.followUp.bind(i);
 i.reply=async payload=>{
  if(payload&&typeof payload==="object"&&!Array.isArray(payload)){
   const clean={...payload};
   delete clean.ephemeral;
   delete clean.flags;
   return _editReply(clean);
  }
  return _editReply(payload);
 };
 i.deferReply=async()=>i; // Prevent older branches from attempting a second defer.
 i.followUp=_followUp;

 const g=i.guildId,u=i.user.id;await acct(g,u);
 if(["balance","account"].includes(i.commandName)){
  const who=i.commandName==="balance"?(i.options.getUser("user")||i.user):i.user;
  const a=await acct(g,who.id);
  const holdings=+(await q(`SELECT COALESCE(SUM(h.shares*s.price),0) v FROM economy_stock_holdings h JOIN economy_stocks s ON s.id=h.stock_id WHERE h.guild_id=$1 AND h.user_id=$2`,[g,who.id])).rows[0].v;
  const property=+(await q(`SELECT COALESCE(SUM(COALESCE(market_value,purchase_price,0)),0) v FROM economy_properties WHERE guild_id=$1 AND user_id=$2`,[g,who.id])).rows[0].v;
  const cr=(await q(`SELECT score FROM economy_credit WHERE guild_id=$1 AND user_id=$2`,[g,who.id])).rows[0];
  const cit=(await q(`SELECT citizen FROM economy_citizenship WHERE guild_id=$1 AND user_id=$2`,[g,who.id])).rows[0];
  const member=await i.guild.members.fetch(who.id).catch(()=>null);
  const prisoner=member?await memberIsPrisoner(member):await isPersistentPrisoner(g,who.id);
  const status=prisoner?"INCARCERATED":cit?.citizen?"CITIZEN":"RESIDENT";
  const net=+a.wallet + +a.bank + Math.round(holdings) + Math.round(property);
  return i.reply(uiCode(uiBox("🏦  REICHSBANK ACCOUNT",[
   uiLine(who.username),
   uiBlank(),
   uiPair("💵 Wallet",rm(+a.wallet)),
   uiPair("🏦 Bank",rm(+a.bank)),
   uiPair("📈 Investments",rm(Math.round(holdings))),
   uiPair("🏠 Property",rm(Math.round(property))),
   uiRule(),
   uiPair("💰 Net Worth",rm(net)),
   uiBlank(),
   uiPair("Credit Score",cr?.score??"Not rated"),
   uiPair("Status",status)
  ],"Account • Updated just now")));
 }
 if(i.commandName==="daily"&&await memberIsPrisoner(i.member)){
  await enforcePrisonerRoles(i.member,"prison_daily_guard");
  return i.reply({content:"🔒 Inmates cannot claim the daily RM reward. Prison work is the available earning method.",ephemeral:true});
 }
 if(i.commandName==="daily"){const a=await acct(g,u),last=a.last_daily?+new Date(a.last_daily):0;if(Date.now()-last<86400000)return i.reply({content:"Daily already claimed.",ephemeral:true});await q(`UPDATE economy_accounts SET wallet=wallet+$3,last_daily=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u,DAILY]);await tx(g,null,u,DAILY,"daily","Daily reward");{
  const fresh=await acct(g,u);
  return i.reply(uiCode(uiBox("🎁  REICHSMARK • DAILY",[
   uiLine(`${i.user.username} claimed a daily allowance.`),
   uiBlank(),
   uiPair("Allowance",rm(DAILY)),
   uiPair("Account Balance",rm(+fresh.wallet)),
   uiBlank(),
   uiLine("✓ Payment deposited")
  ],`TA Reichsmark Economy • Transaction #${shortTx()}`)));
 }}
 if(i.commandName==="work"){
  const a=await acct(g,u),last=a.last_work?+new Date(a.last_work):0;
  if(Date.now()-last<20000)return i.reply({content:"You can work once every 20 seconds.",ephemeral:true});
  const prisoner=await memberIsPrisoner(i.member);
  if(prisoner)await enforcePrisonerRoles(i.member,"prison_work_guard");
  const n=prisoner?crypto.randomInt(PRISON_WORK_MIN,PRISON_WORK_MAX+1):crypto.randomInt(WORK_MIN,WORK_MAX+1);
  await give(g,u,n);
  await q(`UPDATE economy_accounts SET last_work=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u]);
  await tx(g,null,u,n,prisoner?"prison_work":"work",prisoner?"Prison work income":"Work income");
  {
   const fresh=await acct(g,u);
   if(prisoner){
    const job=pick(PRISON_WORK);
    const embed=new EmbedBuilder()
     .setAuthor({name:i.user.username,iconURL:i.user.displayAvatarURL({size:128})})
     .setTitle("🔒 Prison Employment")
     .setDescription(`You worked as a **${job}** and earned **${rm(n)}!**`)
     .addFields(
      {name:"Balance",value:`**${rm(+fresh.wallet)}**`,inline:true},
      {name:"Next Work Period",value:"**20 seconds**",inline:true}
     )
     .setFooter({text:`Norwitz Federal Prison • Transaction #${shortTx()}`})
     .setTimestamp();
    return i.reply({embeds:[embed]});
   }
   const job=pick(CIVIL_WORK);
   const embed=new EmbedBuilder()
    .setAuthor({name:i.user.username,iconURL:i.user.displayAvatarURL({size:128})})
    .setTitle("💼 Employment Completed")
    .setDescription(`You worked as a **${job}** and earned **${rm(n)}!**`)
    .addFields(
     {name:"Balance",value:`**${rm(+fresh.wallet)}**`,inline:true},
     {name:"Next Shift",value:"**20 seconds**",inline:true}
    )
    .setFooter({text:`TA Reichsmark Economy • Transaction #${shortTx()}`})
    .setTimestamp();
   return i.reply({embeds:[embed]});
  }
 }
 if(i.commandName==="rob"){
  const target=i.options.getUser("user",true);
  if(target.bot||target.id===u)return i.reply({content:"Choose another non-bot member.",ephemeral:true});
  if(await memberIsPrisoner(i.member)){
   await enforcePrisonerRoles(i.member,"prison_rob_guard");
   return i.reply({content:uiCode(uiBox("🔒  ACTION DENIED",[
    uiLine("Incarcerated members cannot rob"),
    uiLine("other accounts."),
    uiBlank(),
    uiPair("Status","INCARCERATED"),
    uiLine("Available: /work")
   ],"Norwitz Federal Prison • Account Restricted")),ephemeral:true});
  }
  const targetMember=await i.guild.members.fetch(target.id).catch(()=>null);
  if(!targetMember)return i.reply({content:"That member is not currently in the server.",ephemeral:true});
  if(await memberIsPrisoner(targetMember))return i.reply({content:"Incarcerated accounts cannot be targeted by /rob.",ephemeral:true});

  const robber=await acct(g,u),victim=await acct(g,target.id);
  const last=robber.last_rob?+new Date(robber.last_rob):0;
  const remain=ROB_COOLDOWN-(Date.now()-last);
  if(remain>0){
   const mins=Math.ceil(remain/60000);
   return i.reply({content:`🚨 You need to lay low for **${mins} minute${mins===1?"":"s"}** before another robbery attempt.`,ephemeral:true});
  }
  if(+victim.wallet<50)return i.reply({content:"That member does not have enough wallet RM to make a robbery attempt worthwhile.",ephemeral:true});

  await q(`UPDATE economy_accounts SET last_rob=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u]);
  const incident=shortTx();
  const roll=crypto.randomInt(1,101);
  const jackpot=roll<=5;
  const success=jackpot||roll<=48;

  if(success){
   const cap=jackpot?1500:600;
   const pct=jackpot?0.20:0.12;
   const amount=Math.max(1,Math.min(cap,Math.floor(+victim.wallet*pct),jackpot?crypto.randomInt(600,1501):crypto.randomInt(50,601)));
   const moved=await q(`UPDATE economy_accounts SET wallet=wallet-$3 WHERE guild_id=$1 AND user_id=$2 AND wallet>=$3 RETURNING wallet`,[g,target.id,amount]);
   if(!moved.rowCount)return i.reply({content:"The target's wallet changed before the robbery could finish. No RM was taken.",ephemeral:true});
   await give(g,u,amount);
   await tx(g,target.id,u,amount,jackpot?"robbery_jackpot":"robbery","Fictional RM robbery");
   const witnessed=crypto.randomInt(1,101)<=25;
   const story=pick(jackpot?ROB_JACKPOT:ROB_SUCCESS);
   const fresh=await acct(g,u);
   const embed=new EmbedBuilder()
    .setAuthor({name:i.user.username,iconURL:i.user.displayAvatarURL({size:128})})
    .setTitle(jackpot?"💎 The Heist of the Century!":"💰 Robbery Successful")
    .setDescription(`**${story}**\n\nYou stole **${rm(amount)}** from **${target.username}**!`)
    .addFields(
     {name:"Victim",value:`**${target.username}**`,inline:true},
     {name:"Stolen",value:`**${rm(amount)}**`,inline:true},
     {name:"Your Balance",value:`**${rm(+fresh.wallet)}**`,inline:true},
     {name:"Result",value:jackpot?"💎 **MASSIVE SCORE**":"✅ **SUCCESS**",inline:true},
     {name:"Police Alert",value:witnessed?"🚨 **WITNESSED**":"🕶️ **GOT AWAY UNSEEN**",inline:true},
     {name:"Next Robbery",value:"**10 minutes**",inline:true}
    )
    .setThumbnail(target.displayAvatarURL({size:128}))
    .setFooter({text:`TA Reichsmark Economy • Incident #${incident}`})
    .setTimestamp();
   if(witnessed){
    return i.reply({content:`<@&${POLICE_ROLE_ID}> 🚨 **Theft alert** • Suspect: <@${u}> • Victim: <@${target.id}> • Incident #${incident} • Investigation/arrest processing requested.`,embeds:[embed],allowedMentions:{roles:[POLICE_ROLE_ID],users:[u,target.id]}});
   }
   return i.reply({embeds:[embed]});
  }

  const fine=Math.min(+robber.wallet,crypto.randomInt(75,251));
  if(fine>0){
   await q(`UPDATE economy_accounts SET wallet=wallet-$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,fine]);
   await q(`INSERT INTO economy_treasury(guild_id,balance,tax_revenue,expenses) VALUES($1,$2,0,0) ON CONFLICT(guild_id) DO UPDATE SET balance=economy_treasury.balance+$2`,[g,fine]);
   await tx(g,u,null,fine,"robbery_fine","Failed fictional RM robbery fine");
  }
  const story=pick(ROB_FAIL);
  const fresh=await acct(g,u);
  const embed=new EmbedBuilder()
   .setAuthor({name:i.user.username,iconURL:i.user.displayAvatarURL({size:128})})
   .setTitle("🚔 Robbery Failed")
   .setDescription(`**${story}**\n\nYou tried to rob **${target.username}**, but the attempt failed.`)
   .addFields(
    {name:"Victim",value:`**${target.username}**`,inline:true},
    {name:"Amount Stolen",value:"**RM 0**",inline:true},
    {name:"Fine",value:`**${rm(fine)}**`,inline:true},
    {name:"Your Balance",value:`**${rm(+fresh.wallet)}**`,inline:true},
    {name:"Police",value:"🚨 **BUNDESPOLIZEI NOTIFIED**",inline:true},
    {name:"Next Robbery",value:"**10 minutes**",inline:true}
   )
   .setThumbnail(target.displayAvatarURL({size:128}))
   .setFooter({text:`TA Reichsmark Economy • Incident #${incident}`})
   .setTimestamp();
  return i.reply({content:`<@&${POLICE_ROLE_ID}> 🚨 **Theft suspect:** <@${u}> • Victim: <@${target.id}> • Incident #${incident} • Arrest/processing requested.`,embeds:[embed],allowedMentions:{roles:[POLICE_ROLE_ID],users:[u,target.id]}});
 }
 if(i.commandName==="pay"){
  const target=i.options.getUser("user",true);
  const targetMember=await i.guild.members.fetch(target.id).catch(()=>null);
  if(await memberIsPrisoner(i.member)||(targetMember&&await memberIsPrisoner(targetMember))){
   if(await memberIsPrisoner(i.member))await enforcePrisonerRoles(i.member,"prison_pay_guard");
   return i.reply({content:"🔒 RM transfers to or from incarcerated members are disabled.",ephemeral:true});
  }
 }
 if(i.commandName==="pay"){const to=i.options.getUser("user",true),n=i.options.getInteger("amount",true);if(to.bot||to.id===u)return i.reply({content:"Choose another member.",ephemeral:true});await acct(g,to.id);if(!await take(g,u,n))return i.reply({content:"Not enough RM.",ephemeral:true});await give(g,to.id,n);await tx(g,u,to.id,n,"pay","Member transfer");return i.reply(`💸 <@${u}> paid <@${to.id}> **${rm(n)}**.`);}
 if(["deposit","withdraw"].includes(i.commandName)){const n=i.options.getInteger("amount",true),a=await acct(g,u),d=i.commandName==="deposit";if(d&&+a.wallet<n||!d&&+a.bank<n)return i.reply({content:"Insufficient funds.",ephemeral:true});await q(`UPDATE economy_accounts SET wallet=wallet${d?"-":"+"}$3,bank=bank${d?"+":"-"}$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,n]);await tx(g,u,u,n,d?"bank_deposit":"bank_withdrawal",d?"Wallet → Bank":"Bank → Wallet");return i.reply(`🏦 ${d?"Deposited":"Withdrew"} **${rm(n)}**.`);}
 if(i.commandName==="leaderboard"){const r=(await q(`SELECT user_id,wallet+bank total FROM economy_accounts WHERE guild_id=$1 ORDER BY total DESC LIMIT 10`,[g])).rows;return i.reply({embeds:[new EmbedBuilder().setTitle("🏆 Reichsmark Leaderboard").setDescription(r.map((x,k)=>`**${k+1}.** <@${x.user_id}> — ${rm(x.total)}`).join("\n")||"No accounts.")]});}
 if(i.commandName==="transactions"){const r=(await q(`SELECT * FROM economy_transactions WHERE guild_id=$1 AND(from_user_id=$2 OR to_user_id=$2) ORDER BY created_at DESC LIMIT 15`,[g,u])).rows;return i.reply({content:r.map(x=>`${x.type}: ${rm(x.amount)} • <t:${Math.floor(+new Date(x.created_at)/1000)}:R>`).join("\n")||"No transactions.",ephemeral:true});}
 if(i.commandName==="salary"){const m=await i.guild.members.fetch(u),p=await payroll(m);return i.reply({embeds:[new EmbedBuilder().setTitle("💼 Salary").setDescription(p.map(x=>`${x.role_name}: **${rm(x.amount)}**`).join("\n")||"No payroll role.").addFields({name:"Gross / 24h",value:rm(p.reduce((s,x)=>s+ +x.amount,0))})],ephemeral:true});}
 if(i.commandName==="paycheck"&&await memberIsPrisoner(i.member)){
  await enforcePrisonerRoles(i.member,"prison_paycheck_guard");
  return i.reply({content:"🔒 Inmates cannot collect salary paychecks while incarcerated.",ephemeral:true});
 }
 if(i.commandName==="paycheck"){const a=await acct(g,u),last=a.last_paycheck?+new Date(a.last_paycheck):0;if(Date.now()-last<86400000)return i.reply({content:`Next paycheck <t:${Math.floor((last+86400000)/1000)}:R>.`,ephemeral:true});const m=await i.guild.members.fetch(u),p=await payroll(m);if(!p.length)return i.reply({content:"No configured payroll role.",ephemeral:true});const gross=p.reduce((s,x)=>s+ +x.amount,0),set=(await q(`SELECT * FROM economy_settings WHERE guild_id=$1`,[g])).rows[0];let rate=m.roles.cache.has(ECONOMIC_ROLE_IDS["Income Tax"])?+set.income_tax:0;
if(m.roles.cache.has(ECONOMIC_ROLE_IDS["Large Property Tax"]))rate+=+set.large_property_tax;
else if(m.roles.cache.has(ECONOMIC_ROLE_IDS["Property Tax"]))rate+=+set.property_tax;const tax=Math.min(gross,Math.round(gross*rate/100)),net=gross-tax;await give(g,u,net);await q(`UPDATE economy_accounts SET last_paycheck=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u]);await q(`UPDATE economy_treasury SET balance=balance+$2,tax_revenue=tax_revenue+$2 WHERE guild_id=$1`,[g,tax]);await tx(g,null,u,net,"payroll",`Gross ${gross}; tax ${tax}`);return i.reply(`💵 Gross **${rm(gross)}** • Tax **${rm(tax)}** • Net **${rm(net)}**`);}
 if(i.commandName==="treasury"){const t=(await q(`SELECT * FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0];return i.reply({embeds:[new EmbedBuilder().setTitle("🏛️ Government Treasury").addFields({name:"Balance",value:rm(t.balance),inline:true},{name:"Tax Revenue",value:rm(t.tax_revenue),inline:true})]});}
 if(i.commandName==="casino"){
  const game=i.options.getString("game",true),bet=i.options.getInteger("bet",true),choice=(i.options.getString("choice")||"").toLowerCase();
  if(game==="coinflip"&&!["heads","tails"].includes(choice))return i.reply({content:"Choose **heads** or **tails**.",ephemeral:true});
  if(game==="roulette"&&!["red","black"].includes(choice))return i.reply({content:"Choose **red** or **black**.",ephemeral:true});
  if(game==="cockfight"&&choice&&!["a","b","red","blue"].includes(choice))return i.reply({content:"Choose **A/B** (or **red/blue**) for the virtual cock fight.",ephemeral:true});
  if(!await take(g,u,bet))return i.reply({content:"Not enough RM.",ephemeral:true});
  let win=0,msg="";
  if(game==="coinflip"){const r=crypto.randomInt(2)?"heads":"tails";win=(choice===r)?bet*2:0;msg=`🪙 **${r.toUpperCase()}**`;}
  else if(game==="dice"){const d=crypto.randomInt(1,7);win=d>=5?bet*2:0;msg=`🎲 Rolled **${d}**`;}
  else if(game==="slots"){const a=[crypto.randomInt(6),crypto.randomInt(6),crypto.randomInt(6)];win=a[0]===a[1]&&a[1]===a[2]?bet*6:(a[0]===a[1]||a[1]===a[2]||a[0]===a[2]?bet*2:0);msg=`🎰 ${a.map(x=>["🍒","🍋","🔔","⭐","💎","7️⃣"][x]).join(" | ")}`;}
  else if(game==="roulette"){const r=crypto.randomInt(2)?"red":"black";win=(choice===r)?bet*2:0;msg=`🎡 **${r.toUpperCase()}**`;}
  else if(game==="cockfight"){const r=crypto.randomInt(2)?"a":"b",pickSide=choice==="red"?"a":choice==="blue"?"b":(choice||"a");win=pickSide===r?bet*2:0;msg=`🐓 Virtual match winner: **ROOSTER ${r.toUpperCase()}**`;}
  else if(game==="russianroulette"){const chamber=crypto.randomInt(1,7);win=chamber===1?0:Math.floor(bet*1.15);msg=chamber===1?"🎯 Virtual chamber: **LOSS**":"🎯 Virtual chamber: **SAFE**";}
  else{const player=crypto.randomInt(16,22),dealer=crypto.randomInt(16,23);win=(player<=21&&(dealer>21||player>dealer))?bet*2:(player===dealer?bet:0);msg=`🃏 You **${player}** • Dealer **${dealer}**`;}
  if(win)await give(g,u,win);await tx(g,u,win?u:null,bet,"casino",`${game}; payout ${win}`);
  return i.reply(`${msg}\n${win>bet?`🏆 Won **${rm(win-bet)}** profit!`:win===bet?"➖ Push — wager returned.":`💸 Lost **${rm(bet)}**.`}`);
 }
 if(i.commandName==="lottery"){const sub=i.options.getSubcommand(),lot=(await q(`SELECT * FROM economy_lottery WHERE guild_id=$1`,[g])).rows[0];if(sub==="status"){const total=(await q(`SELECT COALESCE(SUM(tickets),0) n FROM economy_lottery_tickets WHERE guild_id=$1`,[g])).rows[0].n;return i.reply(`🎟️ Ticket: **${rm(lot.ticket_price)}** • Jackpot: **${rm(lot.jackpot)}** • Tickets sold: **${total}** • Draw <t:${Math.floor(+new Date(lot.draw_at)/1000)}:R>`);}const n=i.options.getInteger("tickets",true),cost=n*+lot.ticket_price;if(!await take(g,u,cost))return i.reply({content:"Not enough RM.",ephemeral:true});await q(`INSERT INTO economy_lottery_tickets VALUES($1,$2,$3) ON CONFLICT(guild_id,user_id) DO UPDATE SET tickets=economy_lottery_tickets.tickets+$3`,[g,u,n]);await q(`UPDATE economy_lottery SET jackpot=jackpot+$2 WHERE guild_id=$1`,[g,Math.floor(cost*.8)]);return i.reply(`🎟️ Bought **${n}** ticket(s) for **${rm(cost)}**.`);}
 if(i.commandName==="shop"||i.commandName==="buy"){
  const sub=i.commandName==="buy"?"buy":(i.options.getSubcommand(false)||"view");
  if(sub==="view"){
   const items=(await q(`SELECT * FROM economy_shop WHERE guild_id=$1 AND active=TRUE ORDER BY category,price,name`,[g])).rows;
   const groups={};for(const x of items)(groups[x.category||"General"]??=[]).push(x);
   const e=new EmbedBuilder().setTitle("🛒 Reichsmark Marketplace").setDescription("Purchases use fictional RM only.");
   for(const [cat,arr] of Object.entries(groups))e.addFields({name:cat,value:arr.map(x=>`**#${x.id} ${x.name}** — ${rm(x.price)} • Stock ${x.stock}`).join("\n").slice(0,1024)});
   return i.reply({embeds:[e]});
  }
  const id=i.options.getInteger("item",true),item=(await q(`SELECT * FROM economy_shop WHERE id=$1 AND guild_id=$2 AND active=TRUE`,[id,g])).rows[0];
  if(!item||+item.stock===0)return i.reply({content:"That item is unavailable.",ephemeral:true});
  const fp=await fiscalPolicy(g),salesTax=Math.max(0,Math.round(+item.price*(+fp.sales_tax/100))),totalCost=+item.price+salesTax;
  if(!await take(g,u,totalCost))return i.reply({content:`Not enough RM. Price ${rm(item.price)} + tax ${rm(salesTax)} = **${rm(totalCost)}**.`,ephemeral:true});
  if(salesTax)await q(`UPDATE economy_treasury SET balance=balance+$2,tax_revenue=tax_revenue+$2 WHERE guild_id=$1`,[g,salesTax]);
  const dec=(await q(`UPDATE economy_shop SET stock=CASE WHEN stock<0 THEN stock ELSE stock-1 END WHERE id=$1 AND stock<>0 RETURNING stock`,[item.id])).rows[0];
  if(!dec){await give(g,u,totalCost);return i.reply({content:"That item just sold out. Your RM was returned.",ephemeral:true});}
  // Citizenship is a redeemable certificate, not an immediate role purchase.
  // The regular inventory purchase below will store it for !use <item-id>.
  const propertyTypes=new Set(["house","land","property","business"]);
  if(propertyTypes.has(String(item.item_type).toLowerCase())){
   const inserted=(await q(`INSERT INTO economy_properties(guild_id,user_id,item_id,name,purchase_price,market_value) VALUES($1,$2,$3,$4,$5,$5) RETURNING id`,[g,u,item.id,item.name,item.price])).rows[0];
   try{
    const ch=await createPrivatePropertyChannel(i.guild,u,String(item.item_type).toLowerCase(),item.name,inserted.id);
    await q(`UPDATE economy_properties SET channel_id=$2 WHERE id=$1`,[inserted.id,ch.id]);
    await tx(g,u,null,+item.price,"property_purchase",item.name);await syncEconomicRoles(i.member);
    {
     const fresh=await acct(g,u);
     return i.reply(uiCode(uiBox("✓  PURCHASE APPROVED",[
      uiLine(item.name),
      uiPair("Purchase Price",rm(+item.price)),
      uiBlank(),
      uiPair("New Balance",rm(+fresh.wallet)),
      uiBlank(),
      uiLine("🏠 Property registered"),
      uiLine("🔑 Private channel created")
     ],`Reichsmark Economy • Receipt #${shortTx()}`))+`\n<#${ch.id}>`);
    }
   }catch(e){
    console.error("Property channel creation:",e);
    await q(`DELETE FROM economy_properties WHERE id=$1`,[inserted.id]);
    await q(`UPDATE economy_shop SET stock=CASE WHEN stock<0 THEN stock ELSE stock+1 END WHERE id=$1`,[item.id]);
    await give(g,u,totalCost);
    return i.reply({content:"I couldn't create the private property channel, so the purchase was cancelled and your RM was refunded. Make sure the bot has **Manage Channels**.",ephemeral:true});
   }
  }
  await q(`INSERT INTO economy_inventory(guild_id,user_id,item_id,quantity) VALUES($1,$2,$3,1) ON CONFLICT(guild_id,user_id,item_id) DO UPDATE SET quantity=economy_inventory.quantity+1`,[g,u,item.id]);
  await tx(g,u,null,+item.price,"shop_purchase",item.name);
  {
   const fresh=await acct(g,u);
   return i.reply(uiCode(uiBox("✓  PURCHASE APPROVED",[
    uiLine(item.name),
    uiPair("Purchase Price",rm(+item.price)),
    uiPair("New Balance",rm(+fresh.wallet)),
    uiBlank(),
    uiLine("✓ Item added to account"),
    ...(String(item.item_type).toLowerCase()==="citizenship"?[uiLine(`Redeem with !use ${item.id} to become a Citizen`)]:[])
   ],`Reichsmark Economy • Receipt #${shortTx()}`)));
  }
 }
 if(i.commandName==="buy"&&await memberIsPrisoner(i.member)){
  await enforcePrisonerRoles(i.member,"prison_shop_guard");
  return i.reply({content:uiCode(uiBox("🔒  TRANSACTION DENIED",[
   uiLine("Citizenship and shop purchases are"),
   uiLine("unavailable while incarcerated."),
   uiBlank(),
   uiPair("Status","INCARCERATED"),
   uiPair("Citizenship","LOCKED"),
   uiBlank(),
   uiLine("Available: /work")
  ],"Norwitz Federal Prison • Account Restricted")),ephemeral:true});
 }
 if(i.commandName==="use"){
  if(await memberIsPrisoner(i.member))return i.reply({content:"🔒 Items cannot be used while incarcerated.",ephemeral:true});
  const id=i.options.getInteger("item",true);
  const owned=(await q(`SELECT inv.quantity,s.name,s.item_type,s.id,s.description
    FROM economy_inventory inv JOIN economy_shop s ON s.id=inv.item_id
    WHERE inv.guild_id=$1 AND inv.user_id=$2 AND inv.item_id=$3 AND inv.quantity>0`,[g,u,id])).rows[0];
  if(!owned)return i.reply({content:"You do not own this item. Check `!inventory`.",ephemeral:true});
  const kind=String(owned.item_type||"item").toLowerCase();
  if(kind==="citizenship"){
   const citizen=await q(`SELECT citizen FROM economy_citizenship WHERE guild_id=$1 AND user_id=$2`,[g,u]);
   if(citizen.rows[0]?.citizen||i.member.roles.cache.has(AUTO_ROLES.CITIZEN))
    return i.reply({content:"🏛️ You are already a citizen. Your certificate was not consumed.",ephemeral:true});
   const me=await i.guild.members.fetchMe(),citizenRole=await i.guild.roles.fetch(AUTO_ROLES.CITIZEN);
   if(!citizenRole||!citizenRole.editable||!me.permissions.has(PermissionFlagsBits.ManageRoles))
    return i.reply({content:"The citizenship role is not manageable. Give this bot Manage Roles and place its role above Citizen.",ephemeral:true});
   // Grant the role first, then record citizenship; on failure leave inventory untouched.
   try{await i.member.roles.add(citizenRole,"Citizenship certificate redeemed");}
   catch(e){console.error("[CITIZENSHIP USE]",e);return i.reply({content:"Could not grant citizenship. Your item has not been consumed.",ephemeral:true});}
   await q(`INSERT INTO economy_citizenship(guild_id,user_id,citizen,obtained_at,source)
    VALUES($1,$2,TRUE,NOW(),'item_use')
    ON CONFLICT(guild_id,user_id) DO UPDATE SET citizen=TRUE,obtained_at=NOW(),source='item_use'`,[g,u]);
   await syncEconomicRoles(i.member);
  }else if(kind==="role"){
   return i.reply({content:"This role item has no configured Discord role. Ask an administrator to configure it.",ephemeral:true});
  }else if(["house","land","property","business"].includes(kind)){
   return i.reply({content:"Properties and businesses are registered automatically at purchase and cannot be consumed.",ephemeral:true});
  }else{
   return i.reply({content:`**${owned.name}** is a collectible or possession, not a consumable. It remains in your inventory.`,ephemeral:true});
  }
  const used=await q(`UPDATE economy_inventory SET quantity=quantity-1
    WHERE guild_id=$1 AND user_id=$2 AND item_id=$3 AND quantity>0 RETURNING quantity`,[g,u,id]);
  if(!used.rowCount)return i.reply({content:"The item was already consumed.",ephemeral:true});
  await q(`DELETE FROM economy_inventory WHERE guild_id=$1 AND user_id=$2 AND item_id=$3 AND quantity<=0`,[g,u,id]);
  await tx(g,u,null,0,"item_used",owned.name);
  return i.reply(`🏛️ **Citizenship certificate redeemed!** You are now a **Citizen of the Authority**. Your Resident role has been removed and your Citizen role granted.`);
 }
 if(i.commandName==="inventory"){const r=(await q(`SELECT s.id,s.name,s.item_type,i.quantity FROM economy_inventory i JOIN economy_shop s ON s.id=i.item_id WHERE i.guild_id=$1 AND i.user_id=$2 ORDER BY s.name`,[g,u])).rows;return i.reply({content:r.map(x=>`**#${x.id} ${x.name}** ×${x.quantity}${x.item_type==="citizenship"?" • Use with !use "+x.id:""}`).join("\n")||"Inventory empty.",ephemeral:true});}
 if(i.commandName==="properties"){const r=(await q(`SELECT * FROM economy_properties WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows;return i.reply({content:r.map(x=>`🏠 **${x.name}** — <#${x.channel_id}>`).join("\n")||"You own no properties.",ephemeral:true});}
 if(i.commandName==="stocks"){
  const c=marketClock();
  const r=(await q(`SELECT s.*,
    d.open,d.high,d.low,
    COALESCE((SELECT SUM(e.impact_pct) FROM economy_market_events e
      WHERE e.guild_id=s.guild_id AND e.stock_id=s.id AND e.active=TRUE AND e.expires_at>NOW()),0) AS event_impact,
    COALESCE((SELECT STRING_AGG(e.title,' • ' ORDER BY e.created_at DESC) FROM
      (SELECT title,created_at FROM economy_market_events
       WHERE guild_id=s.guild_id AND stock_id=s.id AND active=TRUE AND expires_at>NOW()
       ORDER BY created_at DESC LIMIT 2) e),'') AS event_titles
    FROM economy_stocks s
    LEFT JOIN economy_market_daily_stock d
      ON d.guild_id=s.guild_id AND d.stock_id=s.id AND d.session_date=$2
    WHERE s.guild_id=$1 AND s.active=TRUE ORDER BY s.symbol`,[g,c.date])).rows;
  const lines=r.map(x=>{
   const ref=+x.open||+x.price;
   const pct=ref?((+x.price-ref)/ref*100):0;
   const pressure=+x.event_impact||0;
   const news=x.event_titles
    ?`\n📰 **Active news:** ${x.event_titles} • pressure **${pressure>=0?"+":""}${pressure.toFixed(2)}%**`
    :"";
   return `**${pct>=0?"▲":"▼"} ${x.symbol}** • ${x.name}\n`+
    `**${rm(x.price)}** / share • Session **${pct>=0?"+":""}${pct.toFixed(2)}%** • Available **${Number(x.available_supply??x.supply).toLocaleString()}**`+
    `\nHigh **${x.high!=null?rm(x.high):"—"}** • Low **${x.low!=null?rm(x.low):"—"}** • Volume **${Number(x.volume_24h||0).toLocaleString()}**${news}`;
  });
  return i.reply({embeds:[new EmbedBuilder()
   .setTitle("📈 TA REICHSMARK STOCK EXCHANGE")
   .setDescription(`${marketStatusText()}\n\n${lines.join("\n\n")||"No stocks listed."}`)
   .setFooter({text:"Fictional simulated TA assets • prices move every 60 seconds while open • active market news shown • no real-money value"})
   .setTimestamp()]});
 }
 if(i.commandName==="shares"){
  const r=(await q(`SELECT s.symbol,s.name,s.price,h.shares,h.avg_cost FROM economy_stock_holdings h JOIN economy_stocks s ON s.id=h.stock_id WHERE h.guild_id=$1 AND h.user_id=$2 AND h.shares>0 ORDER BY (h.shares*s.price) DESC`,[g,u])).rows;
  if(!r.length)return i.reply({content:"📊 You do not currently own any stock shares.",ephemeral:true});
  let value=0,cost=0,best=null,worst=null;
  const lines=r.map(x=>{const sh=+x.shares,v=+x.price*sh,c=(+x.avg_cost||0)*sh,p=v-c,pct=c?p/c*100:0;value+=v;cost+=c;const z={symbol:x.symbol,pct,p};if(!best||pct>best.pct)best=z;if(!worst||pct<worst.pct)worst=z;return `**${x.symbol}** • ${sh.toLocaleString()} shares\nPrice **${rm(x.price)}** • Avg cost **${rm(+x.avg_cost||0)}**\nValue **${rm(Math.round(v))}** • P/L **${p>=0?"+":""}${rm(Math.round(p))} (${p>=0?"+":""}${pct.toFixed(2)}%)**`;});
  const pnl=value-cost,pct=cost?pnl/cost*100:0;
  const meter=marketBar(clampMarket(50+pct,0,100),20);
  return i.reply({embeds:[new EmbedBuilder().setTitle("📊 REICHSBANK SECURITIES ACCOUNT • SHARE STATEMENT")
   .setDescription(`**Investor:** <@${u}>\n\n${lines.join("\n\n")}`.slice(0,4000))
   .addFields(
    {name:"💼 Portfolio Summary",value:`Portfolio value **${rm(Math.round(value))}**\nTotal cost basis **${rm(Math.round(cost))}**\nUnrealized P/L **${pnl>=0?"+":""}${rm(Math.round(pnl))}**\nTotal return **${pct>=0?"+":""}${pct.toFixed(2)}%**`,inline:false},
    {name:"📈 Performance",value:`${meter} **${pct>=0?"+":""}${pct.toFixed(2)}%**\nBest holding **${best?.symbol||"—"} • ${best?.pct>=0?"+":""}${best?.pct?.toFixed(2)||"0.00"}%**\nWeakest holding **${worst?.symbol||"—"} • ${worst?.pct>=0?"+":""}${worst?.pct?.toFixed(2)||"0.00"}%**`,inline:false})
   .setFooter({text:"Live unrealized value • updates with Reichsmark Stock Exchange prices • no real-money value"}).setTimestamp()],ephemeral:true});
 }
 if(i.commandName==="portfolio"){
  const r=(await q(`SELECT s.symbol,s.name,s.price,h.shares,h.avg_cost FROM economy_stock_holdings h JOIN economy_stocks s ON s.id=h.stock_id WHERE h.guild_id=$1 AND h.user_id=$2 AND h.shares>0 ORDER BY (h.shares*s.price) DESC`,[g,u])).rows;
  if(!r.length)return i.reply({content:"You do not own any shares yet.",ephemeral:true});
  let value=0,cost=0;
  const lines=r.map(x=>{const v=+x.price*+x.shares,c=(+x.avg_cost||0)*+x.shares,p=v-c,pct=c?p/c*100:0;value+=v;cost+=c;return `**${x.symbol}** × ${x.shares} • ${rm(Math.round(v))}\nAvg ${rm(+x.avg_cost||0)} • P/L **${p>=0?"+":""}${rm(Math.round(p))} (${p>=0?"+":""}${pct.toFixed(2)}%)**`;});
  const pnl=value-cost,pct=cost?pnl/cost*100:0;
  return i.reply({embeds:[new EmbedBuilder().setTitle("💼 Reichsmark Investment Portfolio").setDescription(lines.join("\n\n")).addFields({name:"Portfolio value",value:rm(Math.round(value)),inline:true},{name:"Cost basis",value:rm(Math.round(cost)),inline:true},{name:"Unrealized P/L",value:`${pnl>=0?"+":""}${rm(Math.round(pnl))} (${pnl>=0?"+":""}${pct.toFixed(2)}%)`,inline:true}).setFooter({text:"Fictional TA market • no real-money value"})],ephemeral:true});
 }
 if(i.commandName==="stock"){
  const sub=i.options.getSubcommand(),sym=i.options.getString("symbol",true).toUpperCase();
  if(sub==="trade"){
   if(!marketIsOpen())return i.reply({content:"🔴 The stock exchange is closed. Direct trades can be offered during market hours.",ephemeral:true});
   const buyer=i.options.getUser("user",true),shares=i.options.getInteger("shares",true),price=i.options.getNumber("price",true);
   if(buyer.bot||buyer.id===u)return i.reply({content:"Choose another non-bot member.",ephemeral:true});
   const s=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND symbol=$2 AND active=TRUE`,[g,sym])).rows[0];
   if(!s)return i.reply({content:"Stock not found.",ephemeral:true});
   const h=(await q(`SELECT shares FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[g,u,s.id])).rows[0];
   if(!h||Number(h.shares)<shares)return i.reply({content:`You do not own **${shares} ${sym}** shares.`,ephemeral:true});
   const total=Math.round(shares*price);
   const offer=(await q(`INSERT INTO economy_stock_trade_offers(guild_id,seller_id,buyer_id,stock_id,shares,price_per_share)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[g,u,buyer.id,s.id,shares,price])).rows[0];
   const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`stocktrade_accept_${offer.id}`).setLabel("Accept Trade").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`stocktrade_decline_${offer.id}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
   );
   const embed=new EmbedBuilder().setTitle("🤝 Direct Stock Trade Offer")
    .setDescription(`<@${u}> is offering shares directly to <@${buyer.id}>.`)
    .addFields({name:"Security",value:`**${shares} ${sym}** • ${s.name}`,inline:false},
      {name:"Price / Share",value:`**${rm(price)}**`,inline:true},{name:"Total",value:`**${rm(total)}**`,inline:true},
      {name:"Expires",value:`<t:${Math.floor(new Date(offer.expires_at).getTime()/1000)}:R>`,inline:true})
    .setFooter({text:`TA Reichsmark Exchange • Trade #${offer.id} • fictional RM only`}).setTimestamp();
   const msg=await i.editReply({content:`<@${buyer.id}>`,embeds:[embed],components:[row],allowedMentions:{users:[buyer.id]}});
   await q(`UPDATE economy_stock_trade_offers SET message_id=$2,channel_id=$3 WHERE id=$1`,[offer.id,msg.id,i.channelId]);
   return;
  }
  const s=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND symbol=$2 AND active=TRUE`,[g,sym])).rows[0];
  if(!s)return i.reply({content:"Stock not found.",ephemeral:true});
  if(sub==="info"){
   const c=marketClock();
   const today=(await q(`SELECT * FROM economy_market_daily_stock WHERE guild_id=$1 AND session_date=$2 AND stock_id=$3`,[g,c.date,s.id])).rows[0];
   const prev=(await q(`SELECT d.* FROM economy_market_daily_stock d WHERE d.guild_id=$1 AND d.stock_id=$2 AND d.close IS NOT NULL AND d.session_date<$3 ORDER BY d.session_date DESC LIMIT 1`,[g,s.id,c.date])).rows[0];
   const ref=prev?.close||today?.open||s.price,chg=+ref?((+s.price-+ref)/+ref*100):0;
   const hist=(await q(`SELECT price,created_at FROM economy_stock_history WHERE stock_id=$1 ORDER BY created_at DESC LIMIT 672`,[s.id])).rows;
   const prices=hist.map(x=>+x.price),hi=prices.length?Math.max(...prices):+s.price,lo=prices.length?Math.min(...prices):+s.price;
   const ev=(await q(`SELECT title,impact_pct,expires_at FROM economy_market_events WHERE guild_id=$1 AND stock_id=$2 AND active=TRUE AND expires_at>NOW() ORDER BY created_at DESC LIMIT 3`,[g,s.id])).rows;
   return i.reply({embeds:[new EmbedBuilder().setTitle(`📊 ${s.symbol} • ${s.name}`).setDescription(`**${rm(s.price)}** ${chg>=0?"▲":"▼"} **${chg>=0?"+":""}${chg.toFixed(2)}%**\n${marketStatusText()}`)
    .addFields(
     {name:"Session",value:`Open **${today?rm(today.open):"—"}**\nHigh **${today?rm(today.high):"—"}**\nLow **${today?rm(today.low):"—"}**\nPrevious close **${prev?rm(prev.close):"—"}**`,inline:true},
     {name:"Security",value:`Available **${Number(s.available_supply??s.supply).toLocaleString()}**\nIssued **${Number(s.supply).toLocaleString()}**\nMarket cap **${rm(Math.round(+s.price*+s.supply))}**\nVolume **${Number(s.volume_24h||0).toLocaleString()}**`,inline:true},
     {name:"Recent range",value:`High **${rm(hi)}**\nLow **${rm(lo)}**\nPrice points **${prices.length}**`,inline:true},
     {name:"Active market events",value:ev.length?ev.map(x=>`• **${x.title}** (${+x.impact_pct>=0?"+":""}${+x.impact_pct}%)`).join("\n"):"None"}
    ).setFooter({text:"Fictional TA security • no real-money value"}).setTimestamp()],ephemeral:true});
  }
  if(!marketIsOpen())return i.reply({content:`🔴 **MARKET CLOSED**\nTrading is available **Monday–Saturday, 9:00 AM–4:00 PM ET**.`,ephemeral:true});
  const ms=(await q(`SELECT trading_channel_id FROM economy_market_settings WHERE guild_id=$1`,[g])).rows[0];
  if(ms?.trading_channel_id&&i.channelId!==ms.trading_channel_id)return i.reply({content:`💹 Stock trades must be placed in <#${ms.trading_channel_id}>.`,ephemeral:true});
  const shares=i.options.getInteger("shares",true),cost=Math.round(+s.price*shares);
  if(sub==="buy"){
   if(+(s.available_supply??s.supply)<shares)return i.reply({content:`Only ${Number(s.available_supply??s.supply).toLocaleString()} ${sym} shares are available.`,ephemeral:true});
   if(!await take(g,u,cost))return i.reply({content:"Not enough RM.",ephemeral:true});
   const old=(await q(`SELECT shares,avg_cost FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[g,u,s.id])).rows[0];
   const oldShares=+(old?.shares||0),oldAvg=+(old?.avg_cost||0),newShares=oldShares+shares,newAvg=((oldShares*oldAvg)+cost)/newShares;
   await q(`INSERT INTO economy_stock_holdings(guild_id,user_id,stock_id,shares,avg_cost) VALUES($1,$2,$3,$4,$5) ON CONFLICT(guild_id,user_id,stock_id) DO UPDATE SET shares=$4,avg_cost=$5`,[g,u,s.id,newShares,newAvg]);
   await q(`UPDATE economy_stocks SET available_supply=GREATEST(0,available_supply-$2),volume_24h=volume_24h+$2 WHERE id=$1`,[s.id,shares]);
   await tx(g,u,null,cost,"stock_buy",`${shares} ${sym}`);return i.reply(`📈 Bought **${shares} ${sym}** for **${rm(cost)}** at **${rm(s.price)}/share**.`);
  }
  const h=(await q(`SELECT shares,avg_cost FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[g,u,s.id])).rows[0];
  if(!h||+h.shares<shares)return i.reply({content:"Not enough shares.",ephemeral:true});
  await q(`UPDATE economy_stock_holdings SET shares=shares-$4 WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[g,u,s.id,shares]);
  await q(`UPDATE economy_stocks SET available_supply=LEAST(supply,available_supply+$2),volume_24h=volume_24h+$2 WHERE id=$1`,[s.id,shares]);
  await give(g,u,cost);await tx(g,null,u,cost,"stock_sell",`${shares} ${sym}`);return i.reply(`📉 Sold **${shares} ${sym}** for **${rm(cost)}** at **${rm(s.price)}/share**.`);
 }
 if(i.commandName==="bet"){
  const sub=i.options.getSubcommand();
  if(sub==="list"){
   const bets=(await q(`SELECT b.*,COALESCE((SELECT SUM(amount) FROM economy_bet_entries e WHERE e.bet_id=b.id),0) pool FROM economy_bets b WHERE b.guild_id=$1 AND b.status='open' ORDER BY b.created_at DESC LIMIT 20`,[g])).rows;
   return i.reply({embeds:[new EmbedBuilder().setTitle("🎯 Open Community Bets").setDescription(bets.map(b=>`**#${b.id} • ${b.title}**\nA: **${b.option_a}** • B: **${b.option_b}** • Pool **${rm(b.pool)}**`).join("\n\n")||"No open community bets.").setFooter({text:"Fictional RM only"})]});
  }
  const id=i.options.getInteger("id",true),choice=i.options.getString("choice",true),amount=i.options.getInteger("amount",true);
  const b=(await q(`SELECT * FROM economy_bets WHERE id=$1 AND guild_id=$2 AND status='open'`,[id,g])).rows[0];
  if(!b)return i.reply({content:"That bet is not open.",ephemeral:true});
  const existing=(await q(`SELECT 1 FROM economy_bet_entries WHERE bet_id=$1 AND user_id=$2`,[id,u])).rowCount;
  if(existing)return i.reply({content:"You already entered this bet.",ephemeral:true});
  if(!await take(g,u,amount))return i.reply({content:"Not enough RM.",ephemeral:true});
  try{
   await q(`INSERT INTO economy_bet_entries(bet_id,user_id,choice,amount) VALUES($1,$2,$3,$4)`,[id,u,choice,amount]);
   await tx(g,u,null,amount,"community_bet",`Bet #${id} • ${choice}`);
   return i.reply(`🎯 Entered **Bet #${id}** on **${choice}** for **${rm(amount)}**.`);
  }catch(e){await give(g,u,amount);throw e;}
 }
 if(i.commandName==="charts"){
   if(!i.channel?.isTextBased())return i.reply({content:"Use this command in a text channel.",ephemeral:true});
   const stocks=(await q(`SELECT symbol FROM economy_stocks WHERE guild_id=$1 AND active=TRUE ORDER BY symbol`,[g])).rows;
   if(!stocks.length)return i.reply({content:"There are no active stocks to chart yet.",ephemeral:true});
   await i.editReply(`📊 Building **${stocks.length} stock charts + TAIA** here. These cards will stay registered for the synchronized market update cycle.`);
   let made=0,failed=0;
   // TAIA first.
   try{
    const chart=await buildLiveTAIAChart(g),png=await renderChartPng(chart.config);
    const msg=await i.channel.send({embeds:[chart.embed],files:[new AttachmentBuilder(png,{name:"taia-chart.png"})]});
    await q(`INSERT INTO economy_live_index_charts(guild_id,index_symbol,channel_id,message_id,last_sync)
     VALUES($1,'TAIA',$2,$3,NOW()) ON CONFLICT(guild_id,index_symbol) DO UPDATE SET channel_id=$2,message_id=$3,last_sync=NOW()`,[g,i.channelId,msg.id]);
    made++;
   }catch(e){failed++;console.error("All charts TAIA:",e.message);}
   for(const row of stocks){
    try{
     const chart=await buildLiveStockChart(g,row.symbol);if(!chart){failed++;continue;}
     const png=await renderChartPng(chart.config);
     const msg=await i.channel.send({embeds:[chart.embed],files:[new AttachmentBuilder(png,{name:"stock-chart.png"})]});
     await q(`INSERT INTO economy_live_stock_charts(guild_id,symbol,channel_id,message_id,last_sync)
      VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(guild_id,symbol) DO UPDATE SET channel_id=$3,message_id=$4,last_sync=NOW()`,[g,row.symbol,i.channelId,msg.id]);
     made++;
    }catch(e){failed++;console.error(`All charts ${row.symbol}:`,e.message);}
   }
   // Force one refresh after registration so every card starts from the same market snapshot.
   await syncLiveStockCharts();
   await syncLiveIndexCharts();
   return i.followUp(`✅ **All Charts is live.** Registered **${made}** chart${made===1?"":"s"}${failed?` • **${failed} failed** (check Render logs)`:""}.\n🔄 Prices update first, then every registered chart redraws in the same **60-second synchronized cycle**.`);
 }
 if(i.commandName==="chart"){
   const sym=i.options.getString("symbol",true).toUpperCase();
   if(sym==="TAIA"){
    const chart=await buildLiveTAIAChart(g);
    const png=await renderChartPng(chart.config);
    const msg=await i.editReply({embeds:[chart.embed],files:[new AttachmentBuilder(png,{name:"taia-chart.png"})]});
    await q(`INSERT INTO economy_live_index_charts(guild_id,index_symbol,channel_id,message_id,last_sync)
     VALUES($1,'TAIA',$2,$3,NOW()) ON CONFLICT(guild_id,index_symbol) DO UPDATE SET channel_id=$2,message_id=$3,last_sync=NOW()`,
     [g,i.channelId,msg.id]);
    return;
   }
   const chart=await buildLiveStockChart(g,sym);
   if(!chart)return i.reply({content:"Stock not found. Use a listed stock ticker or **TAIA**.",ephemeral:true});
   const png=await renderChartPng(chart.config);
   const msg=await i.editReply({embeds:[chart.embed],files:[new AttachmentBuilder(png,{name:"stock-chart.png"})]});
   await q(`INSERT INTO economy_live_stock_charts(guild_id,symbol,channel_id,message_id,last_sync)
    VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(guild_id,symbol) DO UPDATE SET channel_id=$3,message_id=$4,last_sync=NOW()`,
    [g,sym,i.channelId,msg.id]);
   return;
 }
 if(i.commandName==="announcementlink"){
   const ch=i.options.getChannel("channel",true);
   if(!ch.isTextBased())return i.reply({content:"Choose a text announcements channel.",ephemeral:true});
   await q(`INSERT INTO economy_announcement_links(guild_id,announcement_channel_id,enabled) VALUES($1,$2,TRUE)
    ON CONFLICT(guild_id) DO UPDATE SET announcement_channel_id=$2,enabled=TRUE,updated_at=NOW()`,[g,ch.id]);
   return i.reply({embeds:[new EmbedBuilder().setTitle("🔗 TA Announcements Linked")
    .setDescription(`Every new official announcement in <#${ch.id}> will now be detected and mirrored to **Market News**. Relevant announcements create temporary simulated market pressure; general announcements are reported as neutral.`)
    .addFields({name:"Recognized events",value:"War • Peace • Sanctions • Trade agreements • Emergencies • Infrastructure • Government spending • Tax changes • Energy crises • Major economic reforms"})
    .setFooter({text:"TA Reichsmark Economy • automatic announcement monitor"}).setTimestamp()]});
 }
 if(i.commandName==="announcementstatus"){
   const link=(await q(`SELECT * FROM economy_announcement_links WHERE guild_id=$1`,[g])).rows[0];
   const market=(await q(`SELECT news_channel_id FROM economy_market_settings WHERE guild_id=$1`,[g])).rows[0];
   const last=(await q(`SELECT message_id,event_type,summary,created_at FROM economy_announcement_events WHERE guild_id=$1 ORDER BY created_at DESC LIMIT 1`,[g])).rows[0];
   return i.reply({embeds:[new EmbedBuilder().setTitle("📡 TA Announcement Monitor")
    .addFields({name:"Monitoring",value:link?.enabled?"🟢 Enabled":"🔴 Not enabled",inline:true},{name:"Announcement channel",value:link?.announcement_channel_id?`<#${link.announcement_channel_id}>`:"Not linked",inline:true},{name:"Market News",value:market?.news_channel_id?`<#${market.news_channel_id}>`:"Not configured",inline:true},{name:"Last detected",value:last?`**${String(last.event_type).replaceAll("_"," ")}** • <t:${Math.floor(new Date(last.created_at).getTime()/1000)}:R>\n${String(last.summary||"").slice(0,500)}`:"No announcement detected yet.",inline:false})
    .setFooter({text:"/announcementlink changes the source • /marketsetup controls Market News"}).setTimestamp()]});
 }
 if(i.commandName==="market"){
   await ensureMarketSession(g);
   const embeds=await buildMarketDashboard(g);
   return i.reply({embeds});
 }
 if(i.commandName==="marketsetup"){
   if(!canManageEconomy(i.member))return i.reply({content:"⛔ Market setup is restricted to Administrators and the Commissar of Finance.",ephemeral:true});
   const floor=i.options.getChannel("market_floor",true),news=i.options.getChannel("market_news",true),trading=i.options.getChannel("trading",true);
   if(!floor.isTextBased()||!news.isTextBased()||!trading.isTextBased())return i.reply({content:"Choose text channels.",ephemeral:true});
   await q(`INSERT INTO economy_market_settings(guild_id,market_channel_id,news_channel_id,trading_channel_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(guild_id) DO UPDATE SET market_channel_id=$2,news_channel_id=$3,trading_channel_id=$4`,[g,STOCK_MARKET_DASHBOARD_CHANNEL_ID,news.id,trading.id]);
   await scheduleNextAutoEvent(g,5,20);
   console.log(`[MARKET NEWS] /marketsetup connected news channel ${news.id}.`);
   const marketFloor=await i.guild.channels.fetch(STOCK_MARKET_DASHBOARD_CHANNEL_ID).catch(()=>floor);
   const embeds=await buildMarketDashboard(g),msg=await marketFloor.send({embeds});
   await q(`INSERT INTO economy_market_dashboard(guild_id,channel_id,message_id,last_sync) VALUES($1,$2,$3,NOW())
    ON CONFLICT(guild_id) DO UPDATE SET channel_id=$2,message_id=$3,last_sync=NOW()`,[g,marketFloor.id,msg.id]);
   await ensureEconomicDashboard();
   return i.reply({content:`✅ **Financial Hub connected.**\n📈 Live floor: <#${STOCK_MARKET_DASHBOARD_CHANNEL_ID}>\n🏦 National Economic Center: <#${ECONOMIC_DASHBOARD_CHANNEL_ID}>\n📰 Market news/bells: <#${news.id}>\n💹 Trading: <#${trading.id}>\n\nThe live market board refreshes every 30 seconds; stock prices and charts synchronize every 60 seconds.`,ephemeral:true});
 }
 if(i.commandName==="budget")return i.reply({embeds:[await budgetEmbed(g)]});
 if(i.commandName==="policy"){
  const p=await fiscalPolicy(g),set=(await q(`SELECT * FROM economy_settings WHERE guild_id=$1`,[g])).rows[0],x=await nationalStats(g);
  return i.reply({embeds:[new EmbedBuilder().setTitle("⚙️ AUTOMATIC ECONOMIC POLICY").setDescription(`Automatic mode: **${p.auto_mode?"ON":"OFF"}** • Last adjustment: **${p.last_auto_date||"pending"}**`).addFields(
   {name:"Inflation & Prices",value:`Inflation indicator **${x.inflation.toFixed(2)}%**\nCPI **${(+p.cpi).toFixed(2)}**\nShop prices automatically indexed`,inline:true},
   {name:"Current Taxes",value:`Income **${(+set.income_tax).toFixed(2)}%**\nProperty **${(+set.property_tax).toFixed(2)}%**\nLarge property **${(+set.large_property_tax).toFixed(2)}%**\nSales **${(+p.sales_tax).toFixed(2)}%**\nBusiness **${(+p.business_tax).toFixed(2)}%**`,inline:true},
   {name:"Last Policy Reason",value:p.last_reason||"Stable conditions",inline:false}
  ).setFooter({text:"Interim rules remain automatic until replaced by Congress"}).setTimestamp()]});
 }
 if(i.commandName==="economyreport")return i.reply({embeds:[await buildFinancialReport(g)]});
 if(i.commandName==="gdp"||i.commandName==="economyhistory")return i.reply({embeds:[await buildGdpReport(g,i.commandName==="economyhistory")]});
 if(i.commandName==="reichsbank"){
  const sub=i.options.getSubcommand();
  await q(`INSERT INTO economy_savings(guild_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[g,u]);
  if(sub==="account"){
   const s=(await q(`SELECT * FROM economy_savings WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];
   return i.reply({embeds:[new EmbedBuilder().setTitle("🏦 Reichsbank Savings").setDescription(`Savings balance **${rm(s.balance)}**\nDaily savings yield **0.05%**\nInterest posts approximately every 24 hours while funds remain deposited.`).setFooter({text:"Fictional RM savings • no real-money value"})],ephemeral:true});
  }
  const amount=i.options.getInteger("amount",true);
  if(sub==="deposit"){
   const a=await account(g,u);if(+a.bank<amount)return i.reply({content:"You do not have enough RM in your bank balance.",ephemeral:true});
   await q(`UPDATE economy_accounts SET bank=bank-$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,amount]);
   await q(`UPDATE economy_savings SET balance=balance+$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,amount]);
   await tx(g,u,null,amount,"savings_deposit","Reichsbank savings");return i.reply({content:`🏦 Deposited **${rm(amount)}** into Reichsbank savings.`,ephemeral:true});
  }
  const s=(await q(`SELECT balance FROM economy_savings WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];
  if(+s.balance<amount)return i.reply({content:"You do not have enough RM in savings.",ephemeral:true});
  await q(`UPDATE economy_savings SET balance=balance-$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,amount]);
  await q(`UPDATE economy_accounts SET bank=bank+$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,amount]);
  await tx(g,null,u,amount,"savings_withdraw","Reichsbank savings");return i.reply({content:`🏦 Withdrew **${rm(amount)}** from savings to your bank balance.`,ephemeral:true});
 }
 if(i.commandName==="credit"){
  const c=await recalcCredit(g,u);
  const loans=(await q(`SELECT COALESCE(SUM(balance),0) debt,COUNT(*) FILTER(WHERE status='active') active FROM economy_loans WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];
  return i.reply({embeds:[new EmbedBuilder().setTitle("💳 TA Credit Profile").setDescription(`**${c.score} / 850 — ${creditBand(c.score)}**`).addFields(
   {name:"Payment history",value:`On-time **${c.on_time_payments}**\nLate **${c.late_payments}**`,inline:true},
   {name:"Borrowing",value:`Outstanding **${rm(loans.debt)}**\nActive loans **${loans.active}**`,inline:true},
   {name:"History",value:`Borrowed **${rm(c.total_borrowed)}**\nRepaid **${rm(c.total_repaid)}**`,inline:true}
  ).setFooter({text:"Fictional in-server credit score based only on Reichsmark activity"})],ephemeral:true});
 }
 if(i.commandName==="release"){
  const actor=await i.guild.members.fetch(u);
  if(!actor.permissions.has(PermissionFlagsBits.ManageRoles)&&!actor.permissions.has(PermissionFlagsBits.Administrator))return i.reply({content:"Manage Roles permission required.",ephemeral:true});
  const target=i.options.getUser("user",true);
  const member=await i.guild.members.fetch(target.id).catch(()=>null);
  if(!member||member.user.bot)return i.reply({content:"Select a human member in this server.",ephemeral:true});
  if(!await memberIsPrisoner(member))return i.reply({content:"This member is not currently incarcerated.",ephemeral:true});
  await releasePrisoner(member,`released_by_${u}`);
  return i.reply(`🔓 <@${target.id}> released. Saved roles restored where permitted; Resident/Citizen and economic roles synchronized.`);
 }
 if(i.commandName==="loan"){
  const sub=i.options.getSubcommand(),c=await recalcCredit(g,u);
  if(sub==="status"){const r=(await q(`SELECT * FROM economy_loans WHERE guild_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 10`,[g,u])).rows;return i.reply({content:r.map(x=>`**#${x.id}** ${x.status.toUpperCase()} • Balance ${rm(x.balance)} • Payment ${rm(x.payment_amount)}/day • ${x.interest_rate}%`).join("\n")||"No loans.",ephemeral:true});}
  if(sub==="payoff"){
   const id=i.options.getInteger("id",true);
   const conn=await db.connect();let paid=0;
   try{
    await conn.query("BEGIN");
    const loan=(await conn.query(`SELECT * FROM economy_loans WHERE id=$1 AND guild_id=$2 AND user_id=$3 AND status='active' FOR UPDATE`,[id,g,u])).rows[0];
    if(!loan){await conn.query("ROLLBACK");return i.reply({content:"No active loan with that ID belongs to you.",ephemeral:true});}
    await conn.query(`INSERT INTO economy_accounts(guild_id,user_id,wallet) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[g,u,START]);
    const account=(await conn.query(`SELECT wallet,bank FROM economy_accounts WHERE guild_id=$1 AND user_id=$2 FOR UPDATE`,[g,u])).rows[0];
    paid=Number(loan.balance);
    if(!Number.isSafeInteger(paid)||paid<=0){await conn.query("ROLLBACK");return i.reply({content:"Invalid loan balance; contact finance staff.",ephemeral:true});}
    if(Number(account.wallet)+Number(account.bank)<paid){await conn.query("ROLLBACK");return i.reply({content:`Payoff requires ${rm(paid)}; your wallet and bank have ${rm(Number(account.wallet)+Number(account.bank))}.`,ephemeral:true});}
    const fromBank=Math.min(Number(account.bank),paid),fromWallet=paid-fromBank;
    await conn.query(`UPDATE economy_accounts SET bank=bank-$3,wallet=wallet-$4 WHERE guild_id=$1 AND user_id=$2`,[g,u,fromBank,fromWallet]);
    await conn.query(`UPDATE economy_loans SET balance=0,status='paid',next_payment=NULL WHERE id=$1`,[id]);
    await conn.query(`UPDATE economy_credit SET on_time_payments=on_time_payments+1,total_repaid=total_repaid+$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,paid]);
    await conn.query(`INSERT INTO economy_transactions(guild_id,from_user_id,to_user_id,amount,type,note) VALUES($1,$2,NULL,$3,'loan_early_payoff',$4)`,[g,u,paid,`Loan #${id} paid off early`]);
    await conn.query("COMMIT");
   }catch(e){await conn.query("ROLLBACK").catch(()=>{});throw e;}finally{conn.release();}
   await recalcCredit(g,u);
   return i.reply({content:`🏦 Loan #${id} paid off early for **${rm(paid)}**! Your loan is closed.`,ephemeral:true});
  }

  const amount=i.options.getInteger("amount",true),days=i.options.getInteger("days",true);
  const active=(await q(`SELECT COUNT(*) n FROM economy_loans WHERE guild_id=$1 AND user_id=$2 AND status='active'`,[g,u])).rows[0].n;
  if(+active>=2)return i.reply({content:"Maximum 2 active loans.",ephemeral:true});
  const max=Math.max(500,Math.floor((c.score-250)*60));if(amount>max)return i.reply({content:`Your current fictional credit profile supports up to **${rm(max)}**.`,ephemeral:true});
  const rate=Math.max(2,Math.min(18,14-(c.score-600)*.025)),total=Math.round(amount*(1+(rate/100)*(days/30))),payment=Math.ceil(total/days);
  await q(`INSERT INTO economy_loans(guild_id,user_id,principal,balance,interest_rate,payment_amount,next_payment,term_days) VALUES($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '1 day',$7)`,[g,u,amount,total,rate,payment,days]);
  await q(`UPDATE economy_credit SET total_borrowed=total_borrowed+$3 WHERE guild_id=$1 AND user_id=$2`,[g,u,amount]);await give(g,u,amount);
  return i.reply({content:`🏦 Loan approved: **${rm(amount)}** • ${days} days • ${rate.toFixed(2)}% simulated rate • automatic daily payment **${rm(payment)}**.`,ephemeral:true});
 }
 if(i.commandName==="business"){
  const sub=i.options.getSubcommand();
  if(sub==="list"){const r=(await q(`SELECT * FROM economy_businesses WHERE guild_id=$1 AND owner_id=$2 ORDER BY valuation DESC`,[g,u])).rows;return i.reply({content:r.map(x=>`**#${x.id} ${x.name}** • ${x.business_type}\nBalance ${rm(x.balance)} • Valuation ${rm(x.valuation)} • Revenue ${rm(x.revenue)}`).join("\n\n")||"You own no registered businesses.",ephemeral:true});}
  if(sub==="create"){
   const name=i.options.getString("name",true),type=i.options.getString("type",true),fee=2500;if(!await take(g,u,fee))return i.reply({content:`Business registration requires **${rm(fee)}**.`,ephemeral:true});
   const clean=`business-${name}`.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").slice(0,80);
   const ch=await i.guild.channels.create({name:clean,type:ChannelType.GuildText,parent:PROPERTY_BUSINESS_CATEGORY_ID,permissionOverwrites:[{id:i.guild.roles.everyone.id,deny:["ViewChannel"]},{id:u,allow:["ViewChannel","SendMessages","ReadMessageHistory"]},{id:client.user.id,allow:["ViewChannel","SendMessages","ManageChannels"]}]});
   try{await q(`INSERT INTO economy_businesses(guild_id,owner_id,name,business_type,valuation,channel_id) VALUES($1,$2,$3,$4,5000,$5)`,[g,u,name,type,ch.id]);}catch{await ch.delete().catch(()=>{});return i.reply({content:"That business name is already registered.",ephemeral:true});}
   await syncEconomicRoles(i.member);return i.reply(`🏢 **${name}** registered. Headquarters: <#${ch.id}>`);
  }
  const id=i.options.getInteger("id",true),amount=i.options.getInteger("amount",true),b=(await q(`SELECT * FROM economy_businesses WHERE id=$1 AND guild_id=$2 AND owner_id=$3`,[id,g,u])).rows[0];
  if(!b)return i.reply({content:"Business not found or you do not own that business.",ephemeral:true});
  if(sub==="deposit"){
   if(!await take(g,u,amount))return i.reply({content:"You do not have enough personal RM for that business deposit.",ephemeral:true});
   await q(`UPDATE economy_businesses SET balance=balance+$2 WHERE id=$1`,[id,amount]);
   await tx(g,u,null,amount,"business_deposit",`Deposit to ${b.name}`);
   return i.reply({content:`🏢 Deposited **${rm(amount)}** into **${b.name}**.`,ephemeral:true});
  }
  if(+b.balance<amount)return i.reply({content:"Business has insufficient funds.",ephemeral:true});
  await q(`UPDATE economy_businesses SET balance=balance-$2 WHERE id=$1`,[id,amount]);await give(g,u,amount);
  await tx(g,null,u,amount,"business_withdrawal",`Withdrawal from ${b.name}`);
  return i.reply({content:`🏢 Withdrew **${rm(amount)}** from **${b.name}**.`,ephemeral:true});
 }
 if(i.commandName==="career"){
  const sub=i.options.getSubcommand();await q(`INSERT INTO economy_careers(guild_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[g,u]);
  if(sub==="profile"){const c=(await q(`SELECT * FROM economy_careers WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0];return i.reply({content:`💼 **${c.career}** • Level **${c.level}** • XP **${c.xp}** • Career earnings **${rm(c.total_earned)}**`,ephemeral:true});}
  if(sub==="choose"){const career=i.options.getString("career",true);await q(`UPDATE economy_careers SET career=$3,level=1,xp=0 WHERE guild_id=$1 AND user_id=$2`,[g,u,career]);return i.reply({content:`Career set to **${career}**.`,ephemeral:true});}
  const c=(await q(`SELECT * FROM economy_careers WHERE guild_id=$1 AND user_id=$2`,[g,u])).rows[0],last=c.last_shift?+new Date(c.last_shift):0;if(Date.now()-last<3600000)return i.reply({content:"You can work one career shift per hour.",ephemeral:true});
  const earned=80+(+c.level*25)+crypto.randomInt(0,61),xp=+c.xp+crypto.randomInt(15,31),level=Math.min(20,1+Math.floor(xp/100));
  await give(g,u,earned);await q(`UPDATE economy_careers SET xp=$3,level=$4,total_earned=total_earned+$5,last_shift=NOW() WHERE guild_id=$1 AND user_id=$2`,[g,u,xp,level,earned]);
  return i.reply(`💼 **${c.career} shift complete** • Earned **${rm(earned)}** • Level **${level}** • XP **${xp}**.`);
 }
 if(i.commandName==="wealth"){
  const people=(await q(`SELECT a.user_id,(a.wallet+a.bank+COALESCE(s.balance,0)+COALESCE((SELECT SUM(h.shares*st.price) FROM economy_stock_holdings h JOIN economy_stocks st ON st.id=h.stock_id WHERE h.guild_id=a.guild_id AND h.user_id=a.user_id),0)+COALESCE((SELECT SUM(p.market_value) FROM economy_properties p WHERE p.guild_id=a.guild_id AND p.user_id=a.user_id),0)+COALESCE((SELECT SUM(b.valuation) FROM economy_businesses b WHERE b.guild_id=a.guild_id AND b.owner_id=a.user_id),0)) net FROM economy_accounts a LEFT JOIN economy_savings s ON s.guild_id=a.guild_id AND s.user_id=a.user_id WHERE a.guild_id=$1 ORDER BY net DESC LIMIT 10`,[g])).rows;
  return i.reply({embeds:[new EmbedBuilder().setTitle("🏆 National Wealth Statistics").setDescription(people.map((x,n)=>`**${n+1}.** <@${x.user_id}> — estimated net worth **${rm(Math.round(+x.net))}**`).join("\n")||"No data.").setFooter({text:"Estimated fictional net worth across RM accounts, investments, property and businesses"})]});
 }
 if(i.commandName==="limitorder"){
  if(!marketIsOpen())return i.reply({content:"🔴 Market closed. Limit orders can be placed during market hours.",ephemeral:true});
  const side=i.options.getString("side",true),sym=i.options.getString("symbol",true).toUpperCase(),shares=i.options.getInteger("shares",true),price=i.options.getNumber("price",true);
  const s=(await q(`SELECT * FROM economy_stocks WHERE guild_id=$1 AND symbol=$2 AND active=TRUE`,[g,sym])).rows[0];if(!s)return i.reply({content:"Stock not found.",ephemeral:true});
  if(side==="sell"){const h=(await q(`SELECT shares FROM economy_stock_holdings WHERE guild_id=$1 AND user_id=$2 AND stock_id=$3`,[g,u,s.id])).rows[0];if(!h||+h.shares<shares)return i.reply({content:"Not enough shares.",ephemeral:true});}
  await q(`INSERT INTO economy_limit_orders(guild_id,user_id,stock_id,side,shares,remaining,limit_price) VALUES($1,$2,$3,$4,$5,$5,$6)`,[g,u,s.id,side,shares,price]);
  return i.reply(`📋 ${side.toUpperCase()} limit order placed: **${shares} ${sym} @ ${rm(price)}**.`);
 }
 if(i.commandName==="orders"){const r=(await q(`SELECT o.*,s.symbol FROM economy_limit_orders o JOIN economy_stocks s ON s.id=o.stock_id WHERE o.guild_id=$1 AND o.user_id=$2 AND o.status='open' ORDER BY o.created_at DESC`,[g,u])).rows;return i.reply({content:r.map(x=>`**#${x.id}** ${x.side.toUpperCase()} ${x.remaining} ${x.symbol} @ ${rm(x.limit_price)}`).join("\n")||"No open orders.",ephemeral:true});}
 if(i.commandName==="finance"){
  if(!canManageEconomy(i.member))return i.reply({content:"⛔ Restricted to Administrators and the Commissar of Finance.",ephemeral:true});
  const sub=i.options.getSubcommand();
  if(sub==="dashboard"){
   const x=await nationalStats(g),loans=(await q(`SELECT COALESCE(SUM(balance),0) debt,COUNT(*) FILTER(WHERE status='active') active FROM economy_loans WHERE guild_id=$1`,[g])).rows[0],biz=(await q(`SELECT COUNT(*) n,COALESCE(SUM(valuation),0) v FROM economy_businesses WHERE guild_id=$1`,[g])).rows[0];
   return i.reply({embeds:[new EmbedBuilder().setTitle("🧾 COMMISSAR OF FINANCE • CONTROL CENTER").addFields(
    {name:"Treasury",value:rm(x.treasury),inline:true},{name:"Money Supply",value:rm(x.money),inline:true},{name:"Output",value:rm(x.gdp),inline:true},
    {name:"Loans",value:`${loans.active} active • ${rm(loans.debt)} outstanding`,inline:true},{name:"Businesses",value:`${biz.n} • ${rm(biz.v)} valuation`,inline:true},{name:"Markets",value:`TAIA ${x.taia.toFixed(2)} • ${rm(Math.round(x.marketCap))} cap`,inline:true}
   ).setFooter({text:"Live fictional TA finance administration"})],ephemeral:true});
  }
  if(sub==="spend"){const amount=i.options.getInteger("amount",true),reason=i.options.getString("reason",true),t=(await q(`SELECT balance FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0];if(+t.balance<amount)return i.reply({content:"Treasury has insufficient RM.",ephemeral:true});await q(`UPDATE economy_treasury SET balance=balance-$2,expenses=expenses+$2 WHERE guild_id=$1`,[g,amount]);await q(`INSERT INTO economy_finance_audit(guild_id,actor_id,action,amount,details) VALUES($1,$2,'treasury_spend',$3,$4)`,[g,u,amount,reason]);return i.reply({content:`🏛️ Recorded **${rm(amount)}** treasury expenditure: ${reason}`,ephemeral:true});}
  const paid=await payDividends(g);return i.reply({content:`💹 Dividend cycle completed. **${rm(paid)}** distributed to shareholders.`,ephemeral:true});
 }
 if(i.commandName==="government"){
  if(!canManageEconomy(i.member))return i.reply({content:"⛔ **REICHSBANK ACCESS DENIED**\nThis command is restricted to server **Administrators** and the **Commissar of Finance**.",ephemeral:true});
  await i.deferReply();
  const embeds=await buildGovernmentDashboard(g);
  const controls=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId("gov_refresh").setLabel("SYNC NOW").setEmoji("🔄").setStyle(ButtonStyle.Primary),
   new ButtonBuilder().setCustomId("gov_live").setLabel("LIVE • 30 SEC").setEmoji("🟢").setStyle(ButtonStyle.Success).setDisabled(true),
   new ButtonBuilder().setCustomId("gov_secure").setLabel("FINANCE SECURE").setEmoji("🔐").setStyle(ButtonStyle.Secondary).setDisabled(true)
  );
  const msg=await i.editReply({embeds,components:[controls],fetchReply:true});
  await q(`INSERT INTO economy_live_dashboard(guild_id,channel_id,message_id,last_sync) VALUES($1,$2,$3,NOW())
           ON CONFLICT(guild_id) DO UPDATE SET channel_id=$2,message_id=$3,last_sync=NOW()`,[g,i.channelId,msg.id]);
  return;
 }
 if(i.commandName==="economyimport"){
  await i.deferReply({ephemeral:true});
if(!canManageEconomy(i.member))return i.editReply("⛔ Legacy imports are restricted to Administrators and the Commissar of Finance.");
  if(!UNB_API_TOKEN)return i.editReply("❌ UNBELIEVABOAT_API_TOKEN is not configured in Render.");
  const sub=i.options.getSubcommand();
  if(sub==="preview"){
   try{
    const r=await unbImportPreview(i.guild);
    return i.editReply(`🔎 **UnbelievaBoat Import Preview**\nCurrent non-bot members checked: **${r.current}**\nMembers with legacy RM to import: **${r.matched}**\nCurrent members with RM 0/no legacy balance: **${r.zero}**\nAlready imported: **${r.already}**\nAPI errors: **${r.errors}**\n\nLegacy RM waiting to import: **${rm(r.total)}**\n\n**No balances were changed.**`);
   }catch(e){return i.editReply(`❌ Preview failed: ${e.message}`);}
  }
  if(sub==="execute"){
   try{
    const r=await unbImportExecute(i.guild,u);
    await economyLog(g,"📦 Legacy Economy Migration Complete",`Started by <@${u}>`,[{name:"Imported Members",value:String(r.imported),inline:true},{name:"Imported Total",value:rm(r.total),inline:true},{name:"Skipped",value:String(r.skipped),inline:true},{name:"Errors",value:String(r.errors),inline:true}]);
    return i.editReply(`✅ **UnbelievaBoat migration complete.**\nImported current members: **${r.imported}**\nImported total: **${rm(r.total)}**\nSkipped/already imported/no balance: **${r.skipped}**\nErrors: **${r.errors}**\n\nOnly people who are **currently in TA** and are not bots were checked.`);
   }catch(e){return i.editReply(`❌ Import failed: ${e.message}`);}
  }
 }
 if(i.commandName==="economylog"){
  if(!canManageEconomy(i.member))return i.reply({content:"⛔ Economy logging is restricted to Administrators and the Commissar of Finance.",ephemeral:true});
  const sub=i.options.getSubcommand();
  if(sub==="setup"){
   const ch=i.options.getChannel("channel",true);
   if(!ch.isTextBased())return i.reply({content:"Choose a text channel.",ephemeral:true});
   await q(`INSERT INTO economy_log_settings(guild_id,channel_id,enabled,updated_at) VALUES($1,$2,TRUE,NOW()) ON CONFLICT(guild_id) DO UPDATE SET channel_id=$2,enabled=TRUE,updated_at=NOW()`,[g,ch.id]);
   await i.reply({content:`✅ Economy audit logging connected to <#${ch.id}>.`,ephemeral:true});
   await economyLog(g,"✅ Economy Audit Log Enabled",`Configured by <@${u}>`,[{name:"Channel",value:`<#${ch.id}>`,inline:true}]);
   return;
  }
  if(sub==="status"){
   const s=(await q(`SELECT * FROM economy_log_settings WHERE guild_id=$1`,[g])).rows[0];
   return i.reply({content:s?.enabled&&s.channel_id?`📋 Economy audit logging is **enabled** in <#${s.channel_id}>.`:"📋 Economy audit logging is **disabled/not configured**.",ephemeral:true});
  }
  if(sub==="disable"){
   await q(`INSERT INTO economy_log_settings(guild_id,enabled,updated_at) VALUES($1,FALSE,NOW()) ON CONFLICT(guild_id) DO UPDATE SET enabled=FALSE,updated_at=NOW()`,[g]);
   return i.reply({content:"🛑 Economy audit logging disabled.",ephemeral:true});
  }
 }
 if(i.commandName==="economy"){
 if(!canManageEconomy(i.member))return i.reply({content:"⛔ Economy management is restricted to server **Administrators** and the **Commissar of Finance**.",ephemeral:true});
 const sub=i.options.getSubcommand();
 if(sub==="gov-debt"){const n=i.options.getInteger("amount",true);await q(`UPDATE economy_government SET debt=$2 WHERE guild_id=$1`,[g,n]);await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id) VALUES($1,'adjustment','Debt',0,$2,$3)`,[g,`Debt set to ${n}`,u]);return i.reply(`🏦 Government debt set to **${rm(n)}**.`);}
 if(sub==="gov-borrow"){const n=i.options.getInteger("amount",true),note=i.options.getString("note")||"Government borrowing",gov=(await q(`SELECT * FROM economy_government WHERE guild_id=$1`,[g])).rows[0];if(+gov.debt+n>+gov.debt_limit)return i.reply({content:"That would exceed the configured debt limit.",ephemeral:true});await q(`UPDATE economy_government SET debt=debt+$2 WHERE guild_id=$1`,[g,n]);await q(`UPDATE economy_treasury SET balance=balance+$2 WHERE guild_id=$1`,[g,n]);await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id) VALUES($1,'borrowing','Debt Issuance',$2,$3,$4)`,[g,n,note,u]);return i.reply(`🏦 Borrowed **${rm(n)}** into the government treasury.`);}
 if(sub==="gov-repay"){const n=i.options.getInteger("amount",true),gov=(await q(`SELECT * FROM economy_government WHERE guild_id=$1`,[g])).rows[0],t=(await q(`SELECT * FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0],pay=Math.min(n,+gov.debt);if(+t.balance<pay)return i.reply({content:"The treasury does not have enough RM.",ephemeral:true});await q(`UPDATE economy_government SET debt=debt-$2 WHERE guild_id=$1`,[g,pay]);await q(`UPDATE economy_treasury SET balance=balance-$2,expenses=expenses+$2 WHERE guild_id=$1`,[g,pay]);await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id) VALUES($1,'expense','Debt Repayment',$2,'Government debt repayment',$3)`,[g,pay,u]);return i.reply(`✅ Repaid **${rm(pay)}** of government debt.`);}
 if(sub==="gov-spend"){const n=i.options.getInteger("amount",true),cat=i.options.getString("category",true),note=i.options.getString("note")||"",t=(await q(`SELECT balance FROM economy_treasury WHERE guild_id=$1`,[g])).rows[0];if(+t.balance<n)return i.reply({content:"Treasury has insufficient funds.",ephemeral:true});await q(`UPDATE economy_treasury SET balance=balance-$2,expenses=expenses+$2 WHERE guild_id=$1`,[g,n]);await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id) VALUES($1,'expense',$2,$3,$4,$5)`,[g,cat,n,note,u]);return i.reply(`🏛️ Recorded government spending of **${rm(n)}** for **${cat}**.`);}
 if(sub==="gov-revenue"){const n=i.options.getInteger("amount",true),cat=i.options.getString("category",true),note=i.options.getString("note")||"";await q(`UPDATE economy_treasury SET balance=balance+$2 WHERE guild_id=$1`,[g,n]);await q(`INSERT INTO economy_government_ledger(guild_id,kind,category,amount,note,actor_id) VALUES($1,'revenue',$2,$3,$4,$5)`,[g,cat,n,note,u]);return i.reply(`🏛️ Recorded **${rm(n)}** in government revenue for **${cat}**.`);}
 if(sub==="gov-reserve"){const n=i.options.getInteger("amount",true);await q(`UPDATE economy_government SET reserve_balance=$2 WHERE guild_id=$1`,[g,n]);return i.reply(`🏦 Central reserves set to **${rm(n)}**.`);}
 if(sub==="gov-budget"){const name=i.options.getString("name",true),limit=i.options.getInteger("limit",true);await q(`UPDATE economy_government SET budget_name=$2,budget_spending_limit=$3 WHERE guild_id=$1`,[g,name,limit]);return i.reply(`📑 Budget set to **${name}** with a spending limit of **${rm(limit)}**.`);}
 if(sub==="setup"){await seedRoles(i.guild);await seedMarketAndShop(g);return i.reply("✅ Economy systems initialized • TA role IDs synced • stock exchange seeded • marketplace seeded.");}if(sub==="initialize"){await i.deferReply({ephemeral:true});await i.guild.members.fetch();let n=0;for(const m of i.guild.members.cache.values())if(!m.user.bot&&await grant(g,m.id))n++;return i.editReply(`Initialized **${n}** new account(s) with RM 50.`);}if(["add","remove","set"].includes(sub)){const who=i.options.getUser("user",true),n=i.options.getInteger("amount",true);await acct(g,who.id);if(sub==="add")await give(g,who.id,n);if(sub==="remove")await q(`UPDATE economy_accounts SET wallet=GREATEST(0,wallet-$3) WHERE guild_id=$1 AND user_id=$2`,[g,who.id,n]);if(sub==="set")await q(`UPDATE economy_accounts SET wallet=$3 WHERE guild_id=$1 AND user_id=$2`,[g,who.id,n]);await tx(g,null,who.id,n,`admin_${sub}`,`By ${i.user.username}`);return i.reply(`⚙️ Updated **${who.username}**.`);}if(sub==="salary"){const r=i.options.getRole("role",true),n=i.options.getInteger("amount",true),cat=i.options.getString("category",true);await q(`INSERT INTO economy_salary_roles VALUES($1,$2,$3,$4,$5) ON CONFLICT(guild_id,role_id) DO UPDATE SET role_name=$3,category=$4,amount=$5`,[g,r.id,r.name,cat,n]);await economyLog(g,"⚙️ Salary Configuration",`Updated by <@${u}>`,[{name:"Role",value:`<@&${r.id}>`,inline:true},{name:"Salary",value:`${rm(n)} / 24h`,inline:true},{name:"Category",value:cat,inline:true}]);return i.reply(`✅ ${r.name}: **${rm(n)} / 24h**.`);}if(sub==="shop-add"){const name=i.options.getString("name",true),price=i.options.getInteger("price",true),type=i.options.getString("type",true),desc=i.options.getString("description")||"";const r=await q(`INSERT INTO economy_shop(guild_id,name,description,price,base_price,item_type) VALUES($1,$2,$3,$4,$4,$5) RETURNING id`,[g,name,desc,price,type]);await economyLog(g,"🛒 Shop Item Added",`Added by <@${u}>`,[{name:"Item",value:name,inline:true},{name:"Price",value:rm(price),inline:true},{name:"Type",value:type,inline:true}]);return i.reply(`🛒 Added **#${r.rows[0].id} ${name}** for **${rm(price)}**.`);}if(sub==="stock-add"){const sym=i.options.getString("symbol",true).toUpperCase(),name=i.options.getString("name",true),price=i.options.getInteger("price",true),supply=i.options.getInteger("supply",true);await q(`INSERT INTO economy_stocks(guild_id,symbol,name,price,supply) VALUES($1,$2,$3,$4,$5)`,[g,sym,name,price,supply]);await economyLog(g,"📈 Stock Listed",`Listed by <@${u}>`,[{name:"Ticker",value:sym,inline:true},{name:"Price",value:rm(price),inline:true},{name:"Supply",value:String(supply),inline:true}]);return i.reply(`📈 Listed **${sym} — ${name}** at **${rm(price)}**.`);}if(sub==="lottery-draw"){const r=await drawLottery(g);return i.reply(r?`🎉 Lottery winner: <@${r.winner}> — **${rm(r.jackpot)}**!`:"No lottery tickets have been sold.");}if(sub==="bet-create"){const title=i.options.getString("title",true),a=i.options.getString("option_a",true),b=i.options.getString("option_b",true),r=await q(`INSERT INTO economy_bets(guild_id,creator_id,title,option_a,option_b) VALUES($1,$2,$3,$4,$5) RETURNING id`,[g,u,title,a,b]);return i.reply(`🎯 Created bet **#${r.rows[0].id}** — ${title}`);}if(sub==="bet-settle"){const id=i.options.getInteger("id",true),winner=i.options.getString("winner",true),entries=(await q(`SELECT * FROM economy_bet_entries WHERE bet_id=$1`,[id])).rows;if(!entries.length)return i.reply({content:"No entries.",ephemeral:true});const pool=entries.reduce((s,x)=>s+ +x.amount,0),wins=entries.filter(x=>x.choice===winner),winStake=wins.reduce((s,x)=>s+ +x.amount,0);if(winStake)for(const x of wins){const payout=Math.floor(pool*(+x.amount/winStake));await give(g,x.user_id,payout);await tx(g,null,x.user_id,payout,"bet_win",`Bet #${id}`);}await q(`UPDATE economy_bets SET status='settled',winner=$2 WHERE id=$1`,[id,winner]);return i.reply(`✅ Bet **#${id}** settled. Winning side: **${winner}**.`);}}
 }catch(e){console.error(e);const m={content:"Something went wrong. Check the Render logs.",ephemeral:true};if(i.deferred&&!i.replied)return i.editReply({content:m.content}).catch(()=>{});if(i.replied)return i.followUp(m).catch(()=>{});return i.reply(m).catch(()=>{});}
});
client.login(TOKEN);
