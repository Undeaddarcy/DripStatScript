// ==UserScript==
// @name       DripStat DropOut
// @namespace	anonycat
// @version    0.5.260
// @description  Calculates stats in DripStat, and provides a control panel for automation.
// @match      https://dripstat.com/game/
// @grant      none
// ==/UserScript==

//Should powerups and upgrades be automatically purchased as they become affordable?
//(As of level 5, also includes facilities for grabbing spring beans that appear)
crypto.autoPurchase=0;
//Should the BPS rate be increased to simulate automatic cup clicks?
crypto.autoClick=0;
//Should memory automatically be dripped?
//0 = no auto-drip, 1 = auto-drip when buffer is full, 2 = auto-drip as needed to create enough space to pay for upgrades
crypto.autoDrip=0;

//Throttle auto purchases to one every 5 seconds, to avoid flooding the server
var lastBuy = 5;

function init()
{
	//If autoclicking is enabled, each second will pick a random multiplier and count off that many cup clicks.
	//A multiplier of 0 means no clicking, only natural BPS intake.
	//Multipliers greater than 20 are rejected by the server, so we won't ever generate such a thing here.
	
	//Lowest possible multiplier to select
	crypto.cupmultl = 0;
	//Average multiplier
	crypto.cupmultm = 5;
	//There is no variable for the highest multiplier; it's automatically figured as 2*Middle - Low (but capped at 20).
	
	//Keep track of the original names and descriptions
	localStats.powerUps.slice(0).forEach(function(powerUp){
		
		powerUp.upgrades.forEach(function(upgrade){
			upgrade.originalName = upgrade.name;
			upgrade.originalDesc = upgrade.desc;
		});
		
		powerUp.originalName = powerUp.name;
		powerUp.originalDesc = powerUp.desc;
	});
	
	//string (int) seconds to formatted time
	String.prototype.toHHMMSS = function () {
		var seconds = parseInt(this, 10); // don't forget the second param
		if(seconds <= 0)
			return "no time";
		
		var days   = Math.floor(seconds / 86400);
		seconds -= days*86400;
		var hours   = Math.floor(seconds / 3600);
		seconds -= hours*3600;
		var minutes = Math.floor(seconds / 60);
		seconds -= minutes*60;
		
		if (hours   < 10 && days) {hours   = "0"+hours;}
		if (minutes < 10 && hours) {minutes = "0"+minutes;}
		if (seconds < 10) {seconds = "0"+seconds;}
       
		var output = "";
		if(days)
			output = days+"d "+hours+":"+minutes+":"+seconds;
		else if(hours)
			output = hours+":"+minutes+":"+seconds;
		else
			output = minutes+":"+seconds;
       
		return output;
	}
   
	//Create the control panel with divs
	$('#bpsChartContainer').parent().append("<table style='width:100%; height:70px; border-collapse: collapse;'><tr>"
									+"<td rowspan=2 style='width:30%; border: 2px solid black;'><div id='next-purchase-container'></div></td>"
									+"<td colspan=2 style='width:12%; height:35px; border: 2px solid black; border-bottom: none;' class='apy apn' onclick='crypto.autoPurchase = 1 - crypto.autoPurchase'>Auto Buy</td>"
									+"<td colspan=3 style='width:21%; border: 2px solid black; border-bottom: none' class='drip0 drip1 drip2' onclick='crypto.autoDrip = (1 + crypto.autoDrip) % 3'>Auto Drip</td>"
									+"<td colspan=2 style='width:12%; border: 2px solid black; border-bottom: none;' class='acy acn' onclick='crypto.autoClick = 1 - crypto.autoClick'>Auto Click</td>"
									+"<td style='width:15%; border: 2px solid black; border-right:1px solid black'> Auto Click <div id='multl'></div></td>"
									+"<td style='width:5%; border-top: 2px solid black; border-bottom: 2px solid black; background-color: #AFA;' onclick='crypto.cupmultl = Math.min(crypto.cupmultl + 1, crypto.cupmultm)'> + </td>"
									+"<td style='width:5%; border: 2px solid black; border-left: 1px solid black; background-color: #FAA;' onclick='crypto.cupmultl = Math.max(crypto.cupmultl - 1, 0)'> - </td></tr>"
									+"<tr><td style='width:6%; height:35px; border: 2px solid black; border-top: 1px solid black;' class='apn' onclick='crypto.autoPurchase = 0'> Off </td>"
									+"<td style='width:6%; border: 2px solid black; border-top: 1px solid black;' class='apy' onclick='crypto.autoPurchase = 1'> On </td>"
									+"<td style='width:7%; border: 2px solid black; border-top: 1px solid black;' class='drip0' onclick='crypto.autoDrip = 0'> Never </td>"
									+"<td style='width:7%; border: 2px solid black; border-top: 1px solid black;' class='drip1' onclick='crypto.autoDrip = 1'> At <br /> Limit </td>"
									+"<td style='width:7%; border: 2px solid black; border-top: 1px solid black;' class='drip2' onclick='crypto.autoDrip = 2'> For <br /> Costs </td>"
									+"<td style='width:6%; border: 2px solid black; border-top: 1px solid black;' class='acn' onclick='crypto.autoClick = 0'> Off </td>"
									+"<td style='width:6%; border: 2px solid black; border-top: 1px solid black;' class='acy' onclick='crypto.autoClick = 1'> On </td>"
									+"<td style='width:15%; border: 2px solid black; border-right:1px solid black'> Auto Click <div id='multm'></div></td>"
									+"<td style='width:5%; border-top: 2px solid black; border-bottom: 2px solid black; background-color: #AFA;' onclick='crypto.cupmultm = Math.min(crypto.cupmultm + 1, 20)'> + </td>"
									+"<td style='width:5%; border: 2px solid black; border-left: 1px solid black; background-color: #FAA;' onclick='crypto.cupmultm = Math.max(crypto.cupmultm - 1, crypto.cupmultl)'> - </td></tr></table>");
	$("#next-purchase-container").html("<div id='next-purchase-label'></div><div id='next-purchase-payback'></div><div id='next-purchase-time'></div><div id='max-space-label'></div>");
}
 
function loop()
{
	var upgradeCounter = 1;
	var powerupCounter = 1;
	
	
	var mult = 0;
	var multm = 0;
	var bpc = CoffeeCup.calcBytesPerClick();
	
	if (crypto.autoClick)
	{
		multm = crypto.cupmultm;
		mult = Math.min(20,Math.floor(Math.random()*(2 * multm - crypto.cupmultl)+crypto.cupmultl));
        
		if(mult)
			localStats.byteCount += bpc * mult;
        
		if(localStats.byteCount >= localStats.memoryCapacity)
			localStats.byteCount = localStats.memoryCapacity;
	}
    
	if (crypto.autoDrip && localStats.byteCount == localStats.memoryCapacity)
		dripper.dripGlobal();
    
	var data = Array();
	var min = 999999999999;
	var bytesNeeded=0;
	var next = min;
	var minObj = {};
	localStats.powerUps.slice(0).forEach(function(powerUp) {
		powerUp.position = "pu"+powerupCounter;
           
		var hasUpgrade = false;
		powerUp.upgrades.forEach(function(upgrade) {
			hasUpgrade = true;
			upgrade.position = "upg"+upgradeCounter;
			
			//Let's see which upgrade provides the biggest bang for the buck
			//(computed as "time taken before this upgrade will recoup its own cost").
			
			//If the price is so high that the current buffer can't possibly hold enough
			//(even if we cashed out for more space right now),
			//the "real" price includes what it takes to earn that extra buffer space.
			
			//If there's an object we can afford right now,
			//which will pay itself back in 2 hours,
			//and another object that would nominally pay itself back in 1h50m,
			//except that we can't afford it for 20 more minutes,
			//we should account for that in the time before recouping.
			//Add the time spent waiting to accrue sufficient funds.
			
			//Oh, and if we need 100MB for something, but can only hold 80MB
			//(with 70MB of it filled already), we can't just drip 20MB and keep the rest.
			//We have to drip everything at once, shooting all the way to 150MB.
			//Thus we can't make any progress on affording the item until a drip,
			//and then it costs a full additional 100MB after starting from scratch.

			if(upgrade.price > localStats.byteCount + localStats.memoryCapacity)
				bytesNeeded = 2 * upgrade.price - (localStats.memoryCapacity + localStats.byteCount);
			else if(upgrade.price > localStats.memoryCapacity)
				bytesNeeded = upgrade.price;
			else if(upgrade.price > localStats.byteCount)
				bytesNeeded = upgrade.price - localStats.byteCount;
			else
				bytesNeeded = 0;
			
			//Cursor upgrades boost clicking too, so if autoclicks are on, take the rate
			//and overall BPS into account when determining its value.
			if(powerupCounter == 1)
				upgrade.value = upgrade.price/((powerUp.totalBps + multm * bpc) / 10) + bytesNeeded / (multm * bpc + localStats.bps);
			else
				upgrade.value = upgrade.price/(powerUp.totalBps / 10) + bytesNeeded / (multm * bpc + localStats.bps);
			
			min = Math.min(min, upgrade.value);
			if(upgrade.value == min)
				minObj = upgrade;
 
			upgrade.desc = "Pays for itself in "+String(upgrade.value).toHHMMSS() + "<br>" + upgrade.originalDesc;
		});
		
		if(hasUpgrade)
			upgradeCounter++;
		
		powerupCounter++;
		
		//Same procedure on the main power-ups themselves.
		
		if(powerUp.currentPrice > localStats.byteCount + localStats.memoryCapacity)
			bytesNeeded = 2 * powerUp.currentPrice - (localStats.memoryCapacity + localStats.byteCount);
		else if(powerUp.currentPrice > localStats.memoryCapacity)
			bytesNeeded = powerUp.currentPrice;
		else if(powerUp.currentPrice > localStats.byteCount)
			bytesNeeded = powerUp.currentPrice - localStats.byteCount;
		else
			bytesNeeded = 0;
		
		powerUp.value = powerUp.currentPrice/powerUp.currentBps + bytesNeeded / (multm * bpc + localStats.bps);
            
		data.push(powerUp.value);
 
		if(!(powerUp.name == "Spring Framework" && springPowerup.isLocked))
		{
			min = Math.min(min, powerUp.value);
			if(powerUp.value == min)
				minObj = powerUp;
		}
 
	});
       
	$('.storeItem, .upgcontainer').css('background-color', '');
       
	var selector = minObj.position;
	$("#"+selector).css('background-color', '#B2EDED');
 
	$('.storePrice').each(function(index){
		$(this).find('p').remove();
		var content = "<p style=\"display:inline; font-size:0.7em;\"> ("+String(data[index]).toHHMMSS()+")</p>";
		$(this).append(content);
	});
       
	var label = minObj.name;
	
	if(minObj.powerup) //Is our best deal an upgrade or a powerup? They use different syntax.
	{
		label += " (Upgrade)";
		var price = minObj.price;
	}
	else
		var price = minObj.currentPrice;
	
	var limitTime = Number((localStats.memoryCapacity - localStats.byteCount)/(multm * bpc + localStats.bps)).toFixed(0);
	var limitstr = "";
   
	if(price > localStats.byteCount + localStats.memoryCapacity)
	{
		var time = Number((2 * price - (localStats.memoryCapacity + localStats.byteCount))/(multm * bpc + localStats.bps)).toFixed(0);
		if(localStats.memoryCapacity==localStats.byteCount)
			limitstr = " (Drip NOW!)";
	}
	else if(price > localStats.memoryCapacity)
	{
		var time = Number(price/(multm * bpc + localStats.bps)).toFixed(0);
		limitstr = " (Drip NOW!)";
		if(crypto.autoDrip >= 2)
			dripper.dripGlobal();
	}
	else
		var time = Number((price - localStats.byteCount)/(multm * bpc + localStats.bps)).toFixed(0);
	
	//Now to fill the control panel.
   
	$("#next-purchase-label").html("Next Purchase: <strong>"+label+"</strong>");
	$("#next-purchase-payback").html("Pays for itself in "+String(minObj.value).toHHMMSS());
	
	if(time <= 0)
		$("#next-purchase-time").html("Affordable now");
	else
		$("#next-purchase-time").html("Affordable in "+String(time).toHHMMSS()+limitstr);
	
	if(limitTime <= 0)
		$("#max-space-label").html("Capacity is maxed out!");
	else
		$("#max-space-label").html("Capacity maxes out in "+String(limitTime).toHHMMSS());
	
	$("#multl").html("Min. Rate: "+String(crypto.cupmultl));
	$("#multm").html("Avg. Rate: "+String(crypto.cupmultm));
   
	if(crypto.autoPurchase)
	{
		$(".apn").css('background-color', '');
		$(".apy").css('background-color', '#AFA');
	}
	else
	{
		$(".apy").css('background-color', '');
		$(".apn").css('background-color', '#FAA');
	}
	
	if(crypto.autoClick)
	{
		$(".acn").css('background-color', '');
		$(".acy").css('background-color', '#AFA');
	}
	else
	{
		$(".acy").css('background-color', '');
		$(".acn").css('background-color', '#FAA');
	}
	
	if(crypto.autoDrip==2)
	{
		$(".drip0").css('background-color', '');
		$(".drip1").css('background-color', '');
		$(".drip2").css('background-color', '#AFA');
	}
	else if(crypto.autoDrip)
	{
		$(".drip2").css('background-color', '');
		$(".drip0").css('background-color', '');
		$(".drip1").css('background-color', '#AAF');
	}
	else
	{
		$(".drip2").css('background-color', '');
		$(".drip1").css('background-color', '');
		$(".drip0").css('background-color', '#FAA');
	}
	
	if(crypto.autoPurchase && price<=localStats.byteCount && lastBuy >= 5)
	{
		minObj.buy(localStats);
		lastBuy = 0;
	}
	else if (lastBuy < 5)
		lastBuy += 1;
	
	if(crypto.autoPurchase && springPowerup.isLocked && mine.beanCount > 0 && AnonymousUserManager.canGrabBean())
	{
		if($('.vex').length)
			vex.closeAll();
		Mine.onGrab();
	}
}
 
init();
setInterval(function(){loop();}, 1000);
