const validateCampaign = campaign => {
	const { recipients, settings, status } = campaign || {};
	const { list_id: listId } = recipients || {};
	const { from_name: senderName, reply_to: senderEmail } = settings || {};
	let canPublish = true;
	if ( 'sent' === status || 'sending' === status ) {
		canPublish = false;
	}
	if ( ! listId ) {
		canPublish = false;
	}
	if ( ! senderName || ! senderName.length || ! senderEmail || ! senderEmail.length ) {
		canPublish = false;
	}
	return canPublish;
};

export const getEditPostPayload = campaign => ( {
	meta: {
		// This meta field does not have to be registered on the back end,
		// as it is not used there.
		is_ready_to_send: validateCampaign( campaign ),
	},
} );
