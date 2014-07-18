/*
Copyright (c) 2011, Shaoting Cai
All rights reserved.

Redistribution and use in source and binary forms, with or without 
modification, are permitted provided that the following conditions 
are met:

Redistributions of source code must retain the above copyright 
notice, this list of conditions and the following disclaimer.
Redistributions in binary form must reproduce the above copyright 
notice, this list of conditions and the following disclaimer in 
the documentation and/or other materials provided with the 
distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS 
FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE 
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, 
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, 
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; 
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT 
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN 
ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
POSSIBILITY OF SUCH DAMAGE.
*/

var DASHBOARD_URL ;
var BUG_URL_PREFIX ;

var STORAGE_KEY_FAVORITE = "favorite";
var STORAGE_KEY_BASE_URL = "base-url";
var STORAGE_KEY_DASHBOARD_URL = "dashboard-url";

/** An array of project short names. */
var favoriteProjects;


/**
 * Event handler for auto-complete's "source" option.
 * @param request "request.term" is the user input.
 * @param response Call response(array) with an array of hinting results.
 */
function autoCompleteSourceFunction(request, response)
{
    var t = $.trim(request.term);
    if(!isNaN(t))
    {
        var r = $.map(favoriteProjects, function(item)
        {
            var bugName = item + '-' + t;
            return { 
                label: "open '" + bugName + "'", 
                value: bugName
            }
        });
        console.log(r);
        response(r);
    }
    else
    {
        response([{
            label: "open '" + t + "'",
            value: t
        }]);
    }
}

/**
 * Initialize popup.html GUI.
 */
function initPopup()
{
    $('button').button();
    
	$('#bug-id').autocomplete({
        delay : 100,
        autoFocus : true,
        minLength : 1,
        source : autoCompleteSourceFunction,
        select : function(event, ui) {
            $('#bug-id').val(ui.item.value);
            openBug();
            return false;
        }
    }).select();
	
	// load history 
	var historyList = $("#history");
	chrome.history.search(
		{
			text:"",
			maxResults:100
		},
		function(historyItems)
		{
			var count = 0;
			historyList.empty();
			$.each(historyItems, function(index, historyItem)
			{
				if(historyItem.url.indexOf(BUG_URL_PREFIX) == 0)
				{
					var link = $("<a>", {				
						href: '#',
						text: historyItem.title,
						title: 'Open ' + historyItem.url.replace(BUG_URL_PREFIX, ''),						
						click: function() { showOrOpenUrl(historyItem.url); }
					});
					
					historyList.append($("<li>").append(link));
					return(++count < 5)					
				}
			});
		}
	);
		
	// load options
	var favorite = localStorage[STORAGE_KEY_FAVORITE];
	var baseUrl = localStorage[STORAGE_KEY_BASE_URL];
	DASHBOARD_URL = localStorage[STORAGE_KEY_DASHBOARD_URL];
	BUG_URL_PREFIX = baseUrl + "browse/";
	if(favorite == null || baseUrl == null)
	{
		var buttonGotoConfig = $("<button>")
		                .text("Please configure options first.")
		                .button()
            			.click(openOptions);
		$("body").empty().append(buttonGotoConfig);		
	}
	else
	{
	    favoriteProjects = favorite.split(" ");
	}
}

/**
 * Open options.html page in a tab.
 */
function openOptions() 
{ 
	chrome.tabs.create({url:"options.html"}); 
}

/**
 * If there's a tab for the given URL, bring the tab to front. Otherwise, create a new tab. 
 */
function showOrOpenUrl(url)
{
	chrome.windows.getCurrent(function(currentWindow) {
		chrome.tabs.getAllInWindow(currentWindow.id, function(tabs){
			var index
			for(index in tabs)
			{
				var tab = tabs[index];
				if(tab.url == url)
				{
					chrome.tabs.update(tab.id, {selected:true});
					return;
				}
			}
			// open in new tab
			chrome.tabs.create({url:url });
		});
	});
}

/**
 * Open dashboard page. 
 */
function openDashboard()
{
	showOrOpenUrl(DASHBOARD_URL);
}


/**
 * Open bug in a tab.
 */
function openBug()
{
	var bugId = $.trim($('#bug-id').val());
	if(bugId.length > 0)
	{
		showOrOpenUrl(BUG_URL_PREFIX + bugId);
	}
}

///////////////////////////////////////////////////////////////
// Option page
///////////////////////////////////////////////////////////////

function saveOptions()
{	
	// check base url
	var baseUrl = $("#base-url").val();
	if(baseUrl.indexOf("http") != 0)
	{
		alert("Invalid 'base URL'\n" + baseUrl);
		$("#base-url").select();
		return false;
	}
	
	// check dashboard url - defaults to base url
	var dashboardUrl = $("#dashboard-url").val();
	if(dashboardUrl.indexOf("http") != 0)
	{
		dashboardUrl = baseUrl;
	}
	
	// normalize favorite projects
	var favorite = $("#favorite").val();
	var projects = favorite.split(" ");
	var normalized = [];
	var i;
	for(i in projects)
	{		
		if((projects[i].length > 0) && ($.inArray(projects[i], normalized) < 0))
		{
			normalized.push(projects[i].toUpperCase());
		}
	};
	
	if(normalized.length == 0)
	{
		alert("Need at least one favorite project.");
		$("#favorite").select();
		return false;
	}
	
	// save options
	localStorage[STORAGE_KEY_BASE_URL] = baseUrl;
	localStorage[STORAGE_KEY_DASHBOARD_URL] = dashboardUrl;
	localStorage[STORAGE_KEY_FAVORITE] = normalized.join(" ");
	
	alert("Options saved.");
	
	// close tab
	chrome.tabs.getCurrent(function(tab){
		chrome.tabs.remove(tab.id);
	});
}


/**
 * Auto-detect options from a sample URL.
 */
function analyze()
{
	var sample = $.trim($("#sample-url").val());
	if(sample.length == 0)
	    return false;
	
	var endOfBase = sample.lastIndexOf("browse/");
	var prefix = sample.substring(0, endOfBase);
	
	$("#base-url").val(prefix);
	$("#dashboard-url").val(prefix + "secure/Dashboard.jspa");	
	
	var startOfBugName = sample.lastIndexOf("/");
	var bugName = sample.substring(startOfBugName + 1);
	var bugNameParts = bugName.split("-");
	if(bugNameParts.length == 2)
	{
		var f = $("#favorite").val();
		$("#favorite").val(f + " " +  bugNameParts[0]);
	}
	
	$("#auto-fill").slideDown();
}

/**
 * Initialize options.html page.
 */
function initOptions()
{
    $('button').button();
	if(localStorage[STORAGE_KEY_BASE_URL] == null)
	{
		$("#auto-fill").hide();
	}
	else
	{
		$("#base-url").val(localStorage[STORAGE_KEY_BASE_URL]);
		$("#dashboard-url").val(localStorage[STORAGE_KEY_DASHBOARD_URL]);
		$("#favorite").val(localStorage[STORAGE_KEY_FAVORITE]);
	}
}
