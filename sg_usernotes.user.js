// ==UserScript==
// @name         SG User Notes
// @namespace    https://www.steamgifts.com
// @version      0.1
// @description  Save notes about other users on steamgifts.com
// @author       MH
// @downloadURL	 https://raw.githubusercontent.com/maherm/steamgifts_usernotes/master/sg_usernotes.user.js
// @updateURL	 https://raw.githubusercontent.com/maherm/steamgifts_usernotes/master/sg_usernotes.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.12.0/moment.min.js
// @include      http*://www.steamgifts.com/user/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==

//=====================Constants==============================

var NoteTypes = {
    _removePostfix : "_remove",
    Comment: "comment",
    Blacklist: "blacklist",
    BlacklistRemove :  "blacklist_remove",
    Whitelist: "whitelist",
    WhitelistRemove: "whitelist_remove"
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

//====================Globals=================================

var user_notes;

//====================Main====================================

function main(){
    if(isSelf())
        return;
    injectCss();
    //GM_deleteValue(getUserId()); //for Debugging
    loadNotes();
    createNotesButton();
    createPanel();
    initButtons();
}

function loadNotes(){
    var userId = getUserId();
    user_notes = loadNotesForUser(userId);
}

function initButtons(){
    initNotesButton();
    initWhiteAndBlacklistButtons();
}

function _deleteAllUserNotes(){
    GM_deleteValue(getUserId());
}

function loadNotesForUser(userId){
    var defaultVal = "[]";
    return JSON.parse(GM_getValue(userId,defaultVal));
}

function getUserId(){
    return $("input[name=child_user_id]")[0].value;
}

function isSelf(){
    return $("input[name=child_user_id]").length ===0;
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
    renderNotes();
}

//====================UI Elements==============================


function createNotesButton(){
    $btn = $("<div style=''>").addClass("sidebar__shortcut__sgun_comments").attr("style", "opacity: 1;").attr("data-tooltip","");
    $btn.append($("<i class='sidebar__shortcut__icon-default fa fa-fw fa-comment-o'>"));
    $(".sidebar__shortcut-inner-wrap").append($btn);
}

function createPanel(){
    $panel = $("<div>").addClass("sgun_notes_panel").addClass("sidebar__shortcut-tooltip-absolute").hide();
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
    $button = $("<i class='fa fa-remove sgun_button'>");

    //Create input field
    $input = $("<input type='text'>").addClass("sidebar__search-input").attr("placeholder", "Your note here...");

    //Create form
    $form = $("<form>").append($input);
    $form.append($("<input type='hidden'>").attr("name","noteType").val(noteType));
    $form.append($("<input type='hidden'>").attr("name","noteDate").val(date));

    //Create panel
    $panel = $("<div>").addClass("sgun_new_note").addClass("sidebar__search-container").addClass("sgun_new_note__"+noteType).hide();
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
        $note_html = $("<div>").addClass("sgun_note").addClass("sgun_note__"+note.type);
        $note_html.append($("<span>").addClass("sgun_note_type").append(IconFactory[note.type]()));
        $note_html.append($("<span>").addClass("sgun_note_date").text(moment(note.date).format("YYYY-MM-DD HH:mm")));
        $note_html.append($("<span>").addClass("sgun_note_text").text( note.text));
        $panel.append($note_html);
    }
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
    $(document).off("click", ".sidebar__shortcut__whitelist:not(.is-disabled), .sidebar__shortcut__blacklist:not(.is-disabled)");
    $(document).on("click", ".sidebar__shortcut__whitelist:not(.is-disabled), .sidebar__shortcut__blacklist:not(.is-disabled)", function(){
        var e = $(this);
        $(".sidebar__shortcut__whitelist, .sidebar__shortcut__blacklist").addClass("is-disabled");
        e.toggleClass("is-loading");
        e.hasClass("is-selected") ? e.find("input[name=action]").val("delete") : e.find("input[name=action]").val("insert");
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


//===================Constructor==================================

(function() {
    'use strict';
     main();
})();

function injectCss(){
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
}");
}