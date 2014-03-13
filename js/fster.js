var startingParent;
var metadata;

$(document).ready (function () {
	var containers = [
		{
			"text": "A folder named [STRING]",
			"type": "static_folder",
		},
		{
			"text": "A folder named [METADATA]\n for each item matching [FILTER]",
			"type": "folder",
		},
		{
			"text": "A folder for each value of [METADATA]\n found in items matching [FILTER]",
			"type": "set_folder",
		},
		{
			"text": "A folder mapping [PATH]",
			"type": "mirror_content",
		}
	];

	var leafs = [
		{
			"text": "A file named [METADATA]\n for each item matching [FILTER]",
			"type": "file",
		}
	];

	$.getJSON ('/search', function (data) {
		metadata = new Array ();

		for (i = 0; i < data.length; i++) {
			n = data [i][0];
			n = n.replace ('#', ':');
			n = n.substr (n.lastIndexOf ('/') + 1);
			metadata.push (n);
		}
	});

	$.getJSON ('/browse', function (data) {
		for (i = 0; i < data.length; i++)
			addConfFile (data[i]);
	});

	initShelf (containers, 'containers', 'fold');
	initShelf (leafs, 'leafs', 'leaf');

	$('#tabs a').click(function (e) {
		e.preventDefault();
		$(this).tab('show');
	})

	$('#confslist').on ('click', '.runbutton', function () {
		var name = $(this).parent ().attr ('id');
		$.post ('/open', {confname: name}, function () {});
	});

	$('#confslist').on ('click', '.deletebutton', function () {
		var name = $(this).parent ().attr ('id');

		if (confirm ('Are you sure you want to remove the "' + name + '" configuration?')) {
			$.post ('/remove', {confname: name}, function (resp) {
				$('#confslist #' + resp).remove ();
			});
		}
	});

	$('#containers div').draggable ({
		delay: 200,
		helper: "clone",
		revert: "invalid",
		start: startDrag
	});

	$('#leafs div').draggable ({
		delay: 200,
		helper: "clone",
		revert: "invalid",
		start: startDrag
	});

	$('#root').droppable ({
		hoverClass: "over-drop",
		drop: activateDrop
	});

	$(document).on ('keyup.autocomplete', 'input.metadata', function () {
		$(this).autocomplete ({
			source : metadata
		});
	});

	$(document).on ('click', '.addfilterrow', function () {
		p = $(this).parents ('.filterrow');
		c = p.clone ();
		c.find ('input').val ('');
		$(p).after (c);
		$(this).removeClass ('addfilterrow').removeClass ('glyphicon-plus').addClass ('removefilterrow').addClass ('glyphicon-minus');
	});

	$(document).on ('click', '.removefilterrow', function () {
		p = $(this).parents ('.filterrow');

		if (p.siblings ('.filterrow').length > 0) {
			p.remove ();
		}
		else {
			p.find ('input').val ('');
			$(this).removeClass ('removefilterrow').removeClass ('glyphicon-minus').addClass ('addfilterrow').addClass ('glyphicon-plus');
		}
	});

	$('#saveConf').click (function () {
		var name = $('input[name=saveconfname]').val ();
		if (name == "")
			return;

		var contents = downloadableConf ();

		$.post ('/save', {contents: contents, name: name}, function (resp) {
			if (resp == '0') {
				$('.modal-body').empty ().append ('<div class="alert alert-danger">An error occurred saving the file!</div>');
			}
			else {
				$('.modal-body').empty ().append ('<h3>Configuration saved!</h3>\
					<p>To use it, run:</p><p>fster -c ' + resp + ' /your/preferred/mountpoint</p>\
					<p>Or <a class="runbutton" id="' + name + '">click here to open in your file manager</a>.</p>');

				addConfFile (name);
			}
		});
	});

	$('#saveModal').on ('click', '.runbutton', function () {
		var name = $(this).attr ('id');
		$.get ('/open', {confname: name}, function () {});
	});

	$('#saveModal').on('hidden.bs.modal', function (e) {
		$('.modal-body').empty ().append ('<input type="text" name="saveconfname" placeholder="Name of new file" />');
	});
});

function addConfFile (name) {
	$('#confslist').append ('<li class="list-group-item" id="' + name + '">' + name + '\
					<button type="button" class="runbutton pull-right btn btn-default btn-xs"><span class="glyphicon glyphicon-cog"></span> Run</button>\
					<button type="button" class="deletebutton pull-right btn btn-default btn-xs"><span class="glyphicon glyphicon-remove-circle"></span> Delete</button>\
				</li>');
}

function startDrag (event, ui) {
	$(this).css ('position', 'relative');
	startingParent = $(this).parent ();
}

function commonInput (extraclass) {
	if (extraclass == 'metadata')
		placeholder = 'put here a metadata!';
	else
		placeholder = '';

	return '<input class="well ' + extraclass + '" style="padding: 3px" type="text" placeholder="' + placeholder + '">';
}

function filterBox () {
	return '\
<div class="filter">\
	<div class="filterrow">\
		' + commonInput ('metadata') + '\
\
		<select>\
			<option value="is">=</option>\
			<option value="isnot">!=</option>\
			<option value="minor">&lt;</option>\
			<option value="major">&gt;</option>\
		</select>\
\
		' + commonInput ('') + '\
		<span class="glyphicon glyphicon-plus addfilterrow"></span>\
	</div>\
</div>';
}

function activateDrop (event, ui) {
	if (this == startingParent)
		return;

	spid = $(startingParent).attr ('id');

	if (spid == 'containers' || spid == 'leafs') {
		node = ui.draggable.clone ();

		desc = node.find ('p').text ();
		desc = desc.replace ("\n", "<br />");
		desc = desc.replace ("[STRING]", commonInput (''));
		desc = desc.replace ("[PATH]", commonInput ('filepath'));
		desc = desc.replace ("[METADATA]", commonInput ('metadata'));
		desc = desc.replace ("[FILTER]", filterBox ());
		node.find ('p').empty ().append (desc);

		if (node.hasClass ('fold')) {
			node.droppable ({
				greedy: true,
				hoverClass: "over-drop",
				drop: activateDrop
			});
		}

		node.draggable ({
			delay: 200,
			revert: "invalid",
			start: startDrag
		});
	}
	else {
		node = ui.draggable;
	}

	node.css ('position', 'static');

	node.detach ().appendTo (this);
	return false;
}

function initShelf (data, parent, myclass) {
	for (i = 0; i < data.length; i++) {
		c = data [i];

		$('#' + parent).append ('<div class="' + myclass + ' mywell">\
						<p>' + c.text + '</p>\
						<input type="hidden" name="type" value="' + c.type + '" />\
					</div>');
	}
}

function downloadableFilter (node) {
	var ret = '<self_conditions>';

	filter = node.find ('.filter:first');
	filter.find ('.filterrow').each (function () {
		metadata = $(this).find ('.metadata:first').val ();
		operator = $(this).find ('select option:selected').val ();
		value = $(this).find ('input:nth-child(2)').val ();
		ret += '<condition metadata="' + metadata + '" operator="' + operator + '" value="' + value + '" />';
	});

	ret += '</self_conditions>';
	return ret;
}

function downloadableFolderContents (node) {
	ret = '<content>';

	node.find ('.fold').each (function () {
		ret += downloadableConfRec ($(this));
	});

	node.find ('.leaf').each (function () {
		ret += downloadableConfRec ($(this));
	});

	ret += '</content>';
	return ret;
}

function downloadableConfRec (node) {
	type = node.find ('input[name=type]').val ();

	xmlnode = '<' + type + '>';
	contents = '<visualization_policy>';

	switch (type) {
		case 'root':
			contents += downloadableFolderContents (node);
			break;

		case 'static_folder':
			contents += '<name value="' + node.find ('input:first').val () + '" />';
			contents += downloadableFolderContents (node);
			break;

		case 'folder':
			contents += '<name value="' + node.find ('.metadata:first').val () + '" />';
			contents += downloadableFilter (node);
			contents += downloadableFolderContents (node);
			break;

		case 'set_folder':
			xmlnode = '<set_folder metadata="' + node.find ('.metadata:first').val () + '">';
			contents += downloadableFilter (node);
			contents += downloadableFolderContents (node);
			break;

		case 'mirror_content':
			break;

		case 'file':
			contents += '<name value="' + node.find ('.metadata:first').val () + '" />';
			contents += downloadableFilter (node);
			break;
	}

	return xmlnode + contents + '</visualization_policy></' + type + '>';
}

function downloadableConf () {
	var string = '<?xml version="1.0" encoding="utf-8"?><conf xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="FSter.xsd"><exposing_tree>';

	string += downloadableConfRec ($('#root'));
	string += '</exposing_tree></conf>';
	return string;
}

