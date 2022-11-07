const main = require('./main');
const post = require('./post');

if (!post.IsPost) {
    main.Main();
} else {
    post.Post();
}
