package I18nt;

use strict;
use warnings;

sub new {
    my ($class, $data) = @_;
    return bless { data => $data }, $class;
}

sub t {
    my ($self, $path, $params) = @_;
    my @keys = split(/\./, $path);
    my $current = $self->{data};

    foreach my $key (@keys) {
        if (ref($current) eq 'HASH' && exists $current->{$key}) {
            $current = $current->{$key};
        } else {
            return "[$path]";
        }
    }

    if (ref($current) eq '') {
        my $res = $current;
        if ($params) {
            while (my ($k, $v) = each %$params) {
                $res =~ s/\{$k\}/$v/g;
            }
        }
        return $res;
    }

    return $current;
}

1;
