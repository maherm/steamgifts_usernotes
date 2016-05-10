// ==UserScript==
// @name         SG User Notes
// @namespace    https://www.steamgifts.com
// @version      0.5
// @description  Save notes about other users on steamgifts.com
// @author       MH
// @downloadURL	 https://raw.githubusercontent.com/maherm/steamgifts_usernotes/master/sg_usernotes.user.js
// @updateURL	 https://raw.githubusercontent.com/maherm/steamgifts_usernotes/master/sg_usernotes.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.12.0/moment.min.js
// @include      http*://www.steamgifts.com/user/*
// @include      http*://www.steamgifts.com/account/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant unsafeWindow

// ==/UserScript==
(function() {
    'use strict';

//=====================Constants==============================

var NoteTypes = {
    _removePostfix : "_remove",
    Comment: "comment",
    Blacklist: "blacklist",
    BlacklistRemove :  "blacklist_remove",
    Whitelist: "whitelist",
    WhitelistRemove: "whitelist_remove"
};

var ImportModes = {
    ReplaceAll       : "ReplaceAll",
    ReplaceIfExists  : "ReplaceIfExists",
    RetainAll        : "RetainAll"
};

var IconFactory = {};
IconFactory[NoteTypes.Comment] = function(){return $("<i class='fa fa-comment-o' alt='Comment'>");};
IconFactory[NoteTypes.Blacklist] = function(){return $("<i class='fa fa-ban' alt='Added to blacklist'>");};
IconFactory[NoteTypes.BlacklistRemove] =  function(){return $("<i class='fa fa-ban' alt='Removed from blacklist'>");};
IconFactory[NoteTypes.Whitelist] = function(){return  $("<i class='fa fa-heart' alt='Added to whitelist'>");};
IconFactory[NoteTypes.WhitelistRemove] = function(){return  $("<i class='fa fa-heart' alt='Removed from whitelist'>");};

var DisplayText = {};
DisplayText[NoteTypes.Comment] = "";
DisplayText[NoteTypes.Blacklist] = "Added to blacklist";
DisplayText[NoteTypes.BlacklistRemove] = "Removed from blacklist";
DisplayText[NoteTypes.Whitelist] = "Added to whitelist";
DisplayText[NoteTypes.WhitelistRemove] = "Removed from whitelist";



var settings_url = "https://www.steamgifts.com/account/manage/whitelist#userNotes";

//====================Globals=================================

var user_notes;

//====================Main====================================

function main(){
    if(isSelf())
        return;
    if(isAccountPage()){
        injectCss();
        addUserNotesLink();
        if(isUserNotesSettingsPage()){
            switchToUserNotesSettings();
        }
    }else{
        injectCss();
        //GM_deleteValue(getUserId()); //for Debugging
        loadNotes();
        createNotesButton();
        createPanel();
        initButtons();
    }
}

function loadNotes(){
    var userId = getUserId();
    user_notes = loadNotesForUser(userId);
}

function getAllSavedUserIds(){
    return GM_listValues();
}

function loadAllNotes(){
   var userIds = getAllSavedUserIds();
   var vals = {};
   for (var i=0; i<userIds.length;i++) {
      var userId = userIds[i];
      vals[userId] = loadNotesForUser(userId);
   }
   return vals;
}

function loadAllNotesAsStr(){
   return JSON.stringify(loadAllNotes(), undefined, 2);
}

function initButtons(){
    initNotesButton();
    initWhiteAndBlacklistButtons();
}

function deleteNotes(keys){
    for(var i=0;i<keys.length;i++){
        GM_deleteValue(keys[i]);
    }
}

function loadNotesForUser(userId){
    var defaultVal = "[]";
    return JSON.parse(GM_getValue(userId,defaultVal));
}

function getUserId(){
    return $("input[name=child_user_id]")[0].value;
}

function isSelf(){
    var selfHref = $(".nav__button-container.nav__button-container--notification .nav__avatar-inner-wrap").parent("a").attr("href").replace("https://www.steamgifts.com","");
    var curPath = document.URL.replace("https://www.steamgifts.com","");
    return curPath.indexOf(selfHref) === 0;
}

function isAccountPage(){
    return document.URL.indexOf("https://www.steamgifts.com/account/") === 0;
}

function isUserNotesSettingsPage(){
    return document.URL === settings_url;
}

function createNewNote(noteType){
   var date = new Date().getTime();
   saveData(noteType, date, DisplayText[noteType]);
   createNewNotePanel(noteType, date);
}

function saveData(noteType, date, text){
    var userId = getUserId();
    var current = JSON.parse(GM_getValue(userId,"[]"));
    var toChange = current.filter(function(e){return e.type ===noteType && e.date===date;});
    if(toChange.length > 1)
        console.error("Multiple notes with same id properties: "+noteType+", "+date);
    if(toChange.length === 1){
        toChange[0].text = text;
    }else{
        current.push({type: noteType, date: date, text: text});
    }
    GM_setValue(userId, JSON.stringify(current));
    loadNotes();
    updateNotesButton();
    renderNotes();
}

//========================= Settings Page Functions ========================

/* from http://stackoverflow.com/a/30832210 */
function download(text, name, type) {
    var a = document.createElement("a");
    var file = new Blob([text], {type: type});
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
}

/* from http://stackoverflow.com/a/26298948 */
function readSingleFile(e, successCallback) {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    successCallback(contents);
  };
  reader.readAsText(file);
}

function getUserKeys(json){
    return Object.keys(json);
}

function importJson(jsonStr, importMode){
    var json = JSON.parse(jsonStr);
    var userKeys = getUserKeys(json);
    if(importMode === ImportModes.ReplaceAll){
        if (!confirm('Import Mode: Replace all\nImporting will delete ALL previously saved user notes. Are you sure?')) {
            return;
        }
        deleteNotes(getAllSavedUserIds());
    }
    if(importMode === ImportModes.ReplaceExistingUsers){
        if (!confirm('Import Mode: Replace existing\nImporting will override all entries for a user if there is any note for this user in the imported file. Are you sure?')) {
            return;
        }
        deleteNotes(userKeys);
    }
     if(importMode === ImportModes.RetainAll){
         if (!confirm('Import Mode: Retain all\nImporting will retain all previously saved data. This may lead to duplicate entries. Are you sure?')) {
            return;
        }
     }
    
    var allNotesCounter = 0;
    for(var i=0; i<userKeys.length; i++){
        var key = userKeys[i];
        var value = json[key];
        allNotesCounter += value.length;
        GM_setValue(key, JSON.stringify(value));
    }
    
    alert("Succesfully imported "+allNotesCounter+" notes for "+userKeys.length+" different users");
}
//====================UI Elements==============================


function createNotesButton(){
    var $btn = $("<div style=''>").addClass("sidebar__shortcut__sgun_comments").attr("style", "opacity: 1;").attr("data-tooltip","");
    var $icon = $("<i class='sidebar__shortcut__icon-default fa fa-fw sgun__icon'>");
    $btn.append($icon);
    $(".sidebar__shortcut-inner-wrap").append($btn);
    $btn.addClass("sgun__notes_present");
    $icon.removeClass("fa-lg").addClass("fa-stack-1x");
    var $badge = $("<i>").addClass("fa fa-stack-1x fa-inverse sgun__badge");
    var $span = $("<span>").addClass("fa-stack fa-lg").append($icon).append($badge);
    $btn.append($span);
    updateNotesButton();
}

function updateNotesButton(){
    var $icon = $(".sgun__icon");
    var $badge = $icon.siblings(".sgun__badge");
    if(user_notes.length > 0){
             $icon.removeClass("fa-comment-o").addClass("fa-comment");
             $badge.text(user_notes.length);
         }else{
             $icon.removeClass("fa-comment").addClass("fa-comment-o");
             $badge.text("");
        }
}

function createPanel(){
    var $panel = $("<div>").addClass("sgun_notes_panel").addClass("sidebar__shortcut-tooltip-absolute").hide();
    $(".sidebar__shortcut-tooltip-relative").append($panel);
}

function destroyNewNotePanel(){
  $(".sgun_new_note").next().show().end().remove();
  $(".sidebar__shortcut-tooltip-relative").show();
}

function createNewNotePanel(noteType, date){
    //Remove old panel
    destroyNewNotePanel();

    //Create Button
    var $button = $("<i class='fa fa-remove sgun_button'>");

    //Create input field
    var $input = $("<input type='text'>").addClass("sidebar__search-input").attr("placeholder", "Your note here...");

    //Create form
    var $form = $("<form>").append($input);
    $form.append($("<input type='hidden'>").attr("name","noteType").val(noteType));
    $form.append($("<input type='hidden'>").attr("name","noteDate").val(date));

    //Create panel
    var $panel = $("<div>").addClass("sgun_new_note").addClass("sidebar__search-container").addClass("sgun_new_note__"+noteType).hide();
    $panel.append($form);
    $panel.append($button);

    //Add panel to DOM
    $(".sidebar__search-container").before($panel);

    //Init Controls

    //Switch between "Save" and "Clear" button
    $input.on("input paste", function(){
        var btn=$(this).closest(".sgun_new_note").find(".sgun_button");
        btn.removeClass("fa-remove fa-save");
        btn.addClass($(this).val()==="" ? "fa-remove" : "fa-save");
    });

    //Submit on "enter"
    $input.keypress(function(e) {
      if(e.which == 13) {
          e.preventDefault();
          $button.click();
      }
    });

    //Submit action
    $button.on("click", function(){
        if($(this).hasClass("fa-save"))
            saveData(noteType, date, $input.val());
        destroyNewNotePanel();
    });


    //Show the newly created Panel
    $(".sgun_new_note").show().next().hide();
    $(".sidebar__shortcut-tooltip-relative").hide();
    $input.focus();
}

function showNotes(){
    renderNotes();
    $(".sgun_notes_panel").show().siblings().hide();
}

function hideNotes(){
    $(".sgun_notes_panel").hide().siblings().show();
}

function renderNotes(){
    var $panel = $(".sgun_notes_panel");
    $panel.empty();
    if(user_notes.length === 0){
         $panel.append($("<div>No notes for this user</div>"));
    }
    
    for(var i=0; i<user_notes.length; i++){
        var note = user_notes[i];
        var $note_html = $("<div>").addClass("sgun_note").addClass("sgun_note__"+note.type);
        $note_html.append($("<span>").addClass("sgun_note_type").append(IconFactory[note.type]()));
        $note_html.append($("<span>").addClass("sgun_note_date").text(moment(note.date).format("YYYY-MM-DD HH:mm")));
        $note_html.append($("<span>").addClass("sgun_note_text").text( note.text));
        $panel.append($note_html);
    }
}

//=================================UI Elements Settings Page ========================
    
function addUserNotesLink(){
    $("h3.sidebar__heading:contains(Manage)").next().append('<li class="sidebar__navigation__item sgun__settings_link"><a class="sidebar__navigation__item__link" href="'+settings_url+'"><div class="sidebar__navigation__item__name">User Notes</div><div class="sidebar__navigation__item__underline"></div></a></li>');
}

function switchToUserNotesSettings(){
   //Clear Content
   $("div.sidebar~div").children().not(".page__heading").remove();
    //Set Title
   document.title = "Account - Manage - User Notes";
   $("div.sidebar~div .page__heading a:nth-of-type(2)").text("User Notes").attr("href",settings_url);
   
    //Select Menu Item in Sidebar
    $(".sgun__settings_link").addClass("is-selected").siblings().removeClass("is-selected");
    $(".sgun__settings_link .sidebar__navigation__item__link").prepend($("div.sidebar .fa.fa-caret-right"));
    
    renderSettings();
}


function renderSettings(){
    var $importExportRow = createFormRow("Import / Export User Notes", createImportExportDiv());
    var $formRows = $("<div>").addClass("form__rows").append($importExportRow);
    
    $("div.sidebar~div").append($formRows);
}
    
var settingsCounter = 1;
function createFormRow(title, $content){
    var $formHeadingNumber = $("<div>").addClass("form__heading__number").text(settingsCounter++);
    var $formHeadingText = $("<div>").addClass("form__heading__text").text(title);
    var $formHeading = $("<div>").addClass("form__heading").append($formHeadingNumber).append($formHeadingText);
    var $formRowIndent = $("<div>").addClass("form__row__indent").append($content);
    var $formRow = $("<div>").addClass("form__row").append($formHeading).append($formRowIndent);
    return $formRow;
}
    
function createImportExportDiv(){
    var $exportButtonDiv = createButton("export","Export User Notes", "fa-upload");
    initExportButton($exportButtonDiv);
    var $importButtonDiv = createButton("import","Import User Notes", "fa-download");
    var $importButtonLabel = $("<label>").attr("for", "sgun__file_import").append($importButtonDiv);
    var $importFileUpload = $("<input>").attr("type","file").attr("name","sgun__file_import").attr("id", "sgun__file_import");
    var $resultDiv = $("<div>").addClass("sgun__form sgun__form_import_export").append($exportButtonDiv).append($importButtonLabel);
    initImportButton($importFileUpload);
    $resultDiv.append($importFileUpload);
    
    return $resultDiv;
}
    
function createButton(name, title, fa_icon){
    var $icon = $("<i>").addClass("sgun__icon_"+name).addClass("fa "+fa_icon);
    var $buttonDiv = $("<div>").addClass("form__submit-button").addClass("sgun__button_"+name).text(title).prepend($icon);
    return $buttonDiv;
}
//====================Init Controls ==============================


function initNotesButton(){
    $(".sidebar__shortcut-inner-wrap > .sidebar__shortcut__sgun_comments").hover(function() {
        showNotes();
        $(this).siblings().css("opacity", 0.2);
    }, function() {
        hideNotes();
        $(this).siblings().css("opacity", 1);
    })
    .on("click", function(){if(!$(this).hasClass("is-disabled"))createNewNotePanel(NoteTypes.Comment, new Date().getTime());});
}

function initWhiteAndBlacklistButtons(){
    //Replace the original callback with ours
    $(unsafeWindow.document).off("click", ".sidebar__shortcut__whitelist:not(.is-disabled), .sidebar__shortcut__blacklist:not(.is-disabled)");
    $(unsafeWindow.document).on("click", ".sidebar__shortcut__whitelist:not(.is-disabled), .sidebar__shortcut__blacklist:not(.is-disabled)", function(){
        var e = $(this);
        $(".sidebar__shortcut__whitelist, .sidebar__shortcut__blacklist").addClass("is-disabled");
        e.toggleClass("is-loading");
        e.hasClass("is-selected") ? e.find("input[name=action]").val("delete") : e.find("input[name=action]").val("insert");
        var ajax_url = "/ajax.php";
		$.ajax({
            url: ajax_url,
            type: "POST",
            dataType: "json",
            data: e.find("form").serialize(),
            success: function(t) {
                var promptFor = e.hasClass("sidebar__shortcut__whitelist") ? NoteTypes.Whitelist : NoteTypes.Blacklist;
                if("success" === t.type){
                    promptFor += e.hasClass("is-selected") ? NoteTypes._removePostfix : "";
                    e.siblings().removeClass("is-selected");
                    e.toggleClass("is-selected");
                }
                e.toggleClass("is-loading");
                $(".sidebar__shortcut__whitelist, .sidebar__shortcut__blacklist").removeClass("is-disabled");
                createNewNote(promptFor);
            }
        });
    });
}

//===================Init Settings Page UI========================

function initExportButton($exportButtonDiv){
   $exportButtonDiv.click(function(){
       var allSavedDataStr = loadAllNotesAsStr();
       var exportName = "SG_User_Notes_Export_"+moment().format("YYYY_MM_DD-HH_mm")+".json";
       download(allSavedDataStr, exportName, "text/plain");
   });
}

function initImportButton($fileInput){
   $fileInput.change(function(e){readSingleFile(e, function(str){importJson(str, ImportModes.ReplaceAll);});});
}

//===================Constructor==================================

main();

//==================Injected CSS==================================
function injectCss(){
    /*jshint multistr: true */
 GM_addStyle(".sgun_note{ \
 line-height: initial; \
 margin-top: 6px; \
} \
 \
div.sgun_note:first-of-type{ \
 padding-top:12px; \
} \
 \
div.sgun_note:last-of-type{ \
 padding-bottom:12px; \
} \
 \
.sgun_notes_panel { \
 text-align: left; \
} \
 \
.sgun_note_type { \
   margin-right: 4px; \
   font-size: 20px; \
} \
 \
.sgun_note_type .fa{ \
  vertical-align: top; \
  font-size: 25px; \
} \
 \
.sgun_note_text { \
  display: block; \
  padding-left: 28px; \
  color: black; \
} \
 \
.sgun_note_type { \
  float: left; \
} \
 \
.sgun_note_date { \
  display: block; \
  padding-left: 28px; \
  font-size: 10px; \
} \
 \
 \
.sgun_note__blacklist .sgun_note_type, .sgun_note__whitelist_remove .sgun_note_type{ \
 color:red; \
} \
.sgun_note__comment .sgun_note_type{ \
 color:blue; \
} \
.sgun_note__whitelist .sgun_note_type, .sgun_note__blacklist_remove .sgun_note_type{ \
 color:green; \
} \
 \
.sidebar__search-input{ \
background-color: inherit; \
} \
 \
.sgun_new_note__comment { \
 background-color: rgba(0,0,255,0.1); \
} \
 \
.sgun_new_note__whitelist, .sgun_new_note__blacklist_remove { \
 background-color: rgba(0,255,0,0.1); \
} \
 \
.sgun_new_note__blacklist, .sgun_new_note__whitelist_remove { \
 background-color: rgba(255,0,0,0.1); \
} \
 \
/* Settings Page */ \
.sgun__form .form__submit-button  {  \
	padding-left: 7px;  \
    padding-right: 7px;  \
	margin-right: 7px; \
}  \
 \
.form__row .sgun__form .form__submit-button i.fa { \
  padding-right: 6px; \
} \
 \
#sgun__file_import{ \
 display: none; \
} \
 \
.sgun__notes_present i.sgun__badge{ \
	font-size: 0.55em; \
    font-family: sans-serif; \
    text-shadow: none; \
}");
}

})();