import example from './example';
import manual from './manual';
import mailchimp from './mailchimp';
import constant_contact from './constant_contact';
import campaign_monitor from './campaign_monitor';

const SERVICE_PROVIDERS = {
	example,
	manual,
	mailchimp,
	constant_contact,
	campaign_monitor,
};

export const getServiceProvider = () => {
	const serviceProvider =
		window && window.newspack_newsletters_data && window.newspack_newsletters_data.service_provider;
	return {
		name: serviceProvider,
		...SERVICE_PROVIDERS[ serviceProvider || 'example' ],
	};
};
